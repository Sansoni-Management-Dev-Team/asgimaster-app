import { createHash, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin, bearer, emailOTP, magicLink } from 'better-auth/plugins';
import { defaultAc, adminAc, userAc } from 'better-auth/plugins/admin/access';
import type { Config } from './config.js';
import type { Database } from './db/database.js';
import * as schema from './db/schema.js';
import type { Identity } from './identity.js';
import { logAudit } from './identity.js';
import type { MailService } from './mail.js';

const allowed = new Set([
  '/sign-in/magic-link',
  '/magic-link/verify',
  '/email-otp/send-verification-otp',
  '/sign-in/email-otp',
  '/get-session',
  '/sign-out',
]);
export function createAuth(
  database: Database,
  identity: Identity,
  mail: MailService,
  config: Config,
) {
  const { db } = database;
  async function emailLimit(email: string, action: string) {
    const key = createHash('sha256').update(`email:${action}:${email.toLowerCase()}`).digest('hex'),
      now = Date.now();
    const [rate] = await db
      .insert(schema.rateLimit)
      .values({ id: randomUUID(), key, count: 1, lastRequest: now })
      .onConflictDoUpdate({
        target: schema.rateLimit.key,
        set: {
          count: sql`case when ${now} - ${schema.rateLimit.lastRequest} >= 60000 then 1 else ${schema.rateLimit.count}+1 end`,
          lastRequest: sql`case when ${now} - ${schema.rateLimit.lastRequest} >= 60000 then ${now} else ${schema.rateLimit.lastRequest} end`,
        },
      })
      .returning();
    if (rate.count > 5)
      throw new APIError('TOO_MANY_REQUESTS', {
        code: 'RATE_LIMITED',
        message: 'Please wait before trying again.',
      });
  }
  const raw = betterAuth({
    baseURL: config.url,
    basePath: '/v1/auth',
    secret: config.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
    trustedOrigins: [config.url, 'mlaisansoni://'],
    emailAndPassword: { enabled: false, disableSignUp: true },
    session: {
      expiresIn: 30 * 86400,
      updateAge: 86400,
      cookieCache: { enabled: false },
      additionalFields: {
        authenticationMethod: {
          type: 'string',
          required: true,
          defaultValue: 'unknown',
          input: false,
        },
      },
    },
    advanced: {
      useSecureCookies: config.production,
      disableCSRFCheck: false,
      disableOriginCheck: false,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.production,
        path: '/',
      },
      ipAddress: {
        ipAddressHeaders: ['x-sansoni-client-ip'],
        trustedProxies: config.trustedProxyCidrs,
      },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!allowed.has(ctx.path))
          throw new APIError('FORBIDDEN', {
            code: 'ENDPOINT_DISABLED',
            message: 'This operation is unavailable.',
          });
        const headers = ctx.headers ?? ctx.request?.headers;
        const origin = headers?.get('origin');
        if (origin && origin !== config.url && origin !== 'mlaisansoni://')
          throw new APIError('FORBIDDEN', {
            code: 'INVALID_ORIGIN',
            message: 'Origin is not allowed.',
          });
        if (headers?.get('cookie') && ctx.path !== '/get-session' && origin !== config.url)
          throw new APIError('FORBIDDEN', {
            code: 'INVALID_ORIGIN',
            message: 'Cookie mutations require the same origin.',
          });
        for (const key of ['callbackURL', 'newUserCallbackURL', 'errorCallbackURL']) {
          const callback = ctx.body?.[key] ?? ctx.query?.[key];
          if (
            callback !== undefined &&
            (ctx.path === '/magic-link/verify' || callback !== 'mlaisansoni://auth-callback')
          )
            throw new APIError('BAD_REQUEST', {
              code: 'INVALID_CALLBACK',
              message: 'Use the native callback and exchange the credential without a redirect.',
            });
        }
        if (ctx.path === '/email-otp/send-verification-otp' && ctx.body.type !== 'sign-in')
          throw new APIError('FORBIDDEN', {
            code: 'ENDPOINT_DISABLED',
            message: 'Only sign-in codes are supported.',
          });
        if (ctx.path === '/magic-link/verify' && typeof ctx.query?.token === 'string') {
          const identifier =
            'magic-link:' + createHash('sha256').update(ctx.query.token).digest('base64url');
          const [credential] = await db
            .select()
            .from(schema.verification)
            .where(eq(schema.verification.identifier, identifier));
          if (credential) {
            const pending = JSON.parse(credential.value) as { email: string };
            const login = await identity.byEmail(pending.email);
            // Acquire the common identity lock before consuming verification rows.
            if (!login || !(await identity.eligible(login.id)))
              throw new APIError('UNAUTHORIZED', {
                code: 'SIGN_IN_FAILED',
                message: 'This invitation is unavailable.',
              });
          }
        }
        const email = ctx.body?.email;
        if (typeof email === 'string') {
          ctx.body.email = email.toLowerCase();
          await emailLimit(email, ctx.path === '/sign-in/email-otp' ? 'verify' : 'send');
          const login = await identity.byEmail(email);
          const otp = ctx.path !== '/sign-in/magic-link';
          const eligible = login && (await identity.eligible(login.id, false, otp));
          if (!eligible) {
            if (
              ctx.path === '/sign-in/magic-link' ||
              ctx.path === '/email-otp/send-verification-otp'
            )
              return ctx.json(
                ctx.path === '/sign-in/magic-link' ? { status: true } : { success: true },
              );
            throw new APIError('UNAUTHORIZED', {
              code: 'SIGN_IN_FAILED',
              message: 'Unable to sign in. Request a new code or contact support.',
            });
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            throw new APIError('FORBIDDEN', {
              code: 'SIGN_UP_DISABLED',
              message: 'Registration is unavailable.',
            });
          },
        },
        update: {
          before: async (data) => {
            if (Object.keys(data).some((key) => !['emailVerified', 'updatedAt'].includes(key)))
              throw new APIError('FORBIDDEN', {
                code: 'IDENTITY_CHANGE_DISABLED',
                message: 'Identity changes require staff support.',
              });
            return { data };
          },
        },
      },
      session: {
        create: {
          before: async (data, ctx) => {
            if (!(await identity.eligible(data.userId, true, ctx?.path === '/sign-in/email-otp')))
              throw new APIError('UNAUTHORIZED', {
                code: 'SIGN_IN_FAILED',
                message: 'This invitation is unavailable.',
              });
            const authenticationMethod =
              ctx?.path === '/sign-in/email-otp'
                ? 'otp'
                : ctx?.path === '/magic-link/verify'
                  ? 'magic-link'
                  : 'unknown';
            if (authenticationMethod === 'unknown')
              throw new APIError('FORBIDDEN', {
                code: 'ENDPOINT_DISABLED',
                message: 'Unsupported session authentication.',
              });
            await logAudit(database, data.userId, 'auth.sign_in', data.userId, {
              authenticationMethod,
            });
            return { data: { ...data, authenticationMethod } };
          },
        },
      },
    },
    plugins: [
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
        roles: {
          admin: adminAc,
          user: userAc,
          staff: defaultAc.newRole({ user: [], session: [] }),
        },
      }),
      bearer({ requireSignature: true }),
      magicLink({
        disableSignUp: true,
        expiresIn: 300,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, token }) => {
          const login = await identity.byEmail(email);
          if (!login || !(await identity.eligible(login.id)))
            throw new APIError('UNAUTHORIZED', {
              code: 'SIGN_IN_FAILED',
              message: 'Sign-in unavailable.',
            });
          const appLink = new URL('mlaisansoni://auth-callback');
          appLink.searchParams.set('token', token);
          await mail.enqueue(
            login.id,
            'magic-link',
            {
              to: email,
              subject: 'Sign in to Sansoni',
              text: `Open Sansoni to sign in: ${appLink}\nThis link expires in 5 minutes and can be used once. If the app is not installed, visit ${config.url}/sign-in for help. You can also request an email code from the app.`,
            },
            new Date(Date.now() + 300000),
          );
        },
      }),
      emailOTP({
        disableSignUp: true,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp, type }) => {
          const login = await identity.byEmail(email);
          if (type !== 'sign-in' || !login || !(await identity.eligible(login.id, false, true)))
            throw new APIError('UNAUTHORIZED', {
              code: 'SIGN_IN_FAILED',
              message: 'Sign-in unavailable.',
            });
          await mail.enqueue(
            login.id,
            'otp',
            {
              to: email,
              subject: 'Your Sansoni sign-in code',
              text: `Your sign-in code is ${otp}.\nIt expires in 5 minutes and can be used once. Do not share it.`,
            },
            new Date(Date.now() + 300000),
          );
        },
      }),
    ],
  });
  // A failed OTP consumes an attempt even when direct auth.api calls throw.
  // Commit expected auth errors; roll back unexpected errors and 5xx responses.
  const verificationFailure = () =>
    new APIError('UNAUTHORIZED', {
      code: 'SIGN_IN_FAILED',
      message: 'Unable to sign in. Request a new code or contact support.',
    });
  async function run<T>(work: () => Promise<T>, otpVerification = false): Promise<T> {
    const result = await database.transaction(async () => {
      try {
        const value = await work();
        if (value instanceof Response && value.status >= 500)
          throw new Error('Auth transaction failed');
        if (otpVerification && value instanceof Response && !value.ok && value.status !== 429)
          return {
            value: Response.json(
              {
                code: 'SIGN_IN_FAILED',
                message: 'Unable to sign in. Request a new code or contact support.',
              },
              { status: 401 },
            ),
          };
        return { value };
      } catch (error) {
        if (error instanceof APIError && Number(error.statusCode) < 500)
          return {
            error: otpVerification && error.statusCode !== 429 ? verificationFailure() : error,
          };
        throw error;
      }
    });
    if ('error' in result) throw result.error;
    return result.value as T;
  }
  const api = new Proxy(raw.api, {
    get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value === 'function'
        ? (...args: unknown[]) => run(() => value(...args), key === 'signInEmailOTP')
        : value;
    },
  });
  return {
    ...raw,
    api,
    handler: (request: Request) =>
      run(
        () => raw.handler(request),
        new URL(request.url).pathname === '/v1/auth/sign-in/email-otp',
      ),
  };
}
export type Auth = ReturnType<typeof createAuth>;
