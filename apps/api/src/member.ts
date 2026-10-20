import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { MeResponseSchema, OnboardingRecordSchema } from '@mlai-sansoni/contracts';
import type { Services } from './services.js';
import { idempotency, memberLogins, members, onboarding } from './db/schema.js';
import { AppError } from './errors.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function memberRoutes(services: () => Services) {
  const app = new Hono<{ Variables: { member: typeof members.$inferSelect } }>();
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
    c.header('Vary', 'Authorization');
    if (!c.req.header('authorization')?.startsWith('Bearer '))
      throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const { auth, identity, database } = services();
    const sessionHeaders = new Headers(c.req.raw.headers);
    sessionHeaders.delete('cookie');
    const session = await auth.api.getSession({ headers: sessionHeaders });
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const [link] = await database.db
      .select()
      .from(memberLogins)
      .where(eq(memberLogins.userId, session.user.id));
    if (!link || !link.established || link.disabled || !(await identity.eligible(session.user.id)))
      throw new AppError(403, 'MEMBER_REQUIRED', 'This login has no eligible member profile.');
    const [member] = await database.db.select().from(members).where(eq(members.id, link.memberId));
    if (!member) throw new AppError(403, 'MEMBER_REQUIRED', 'This login has no member profile.');
    c.set('member', member);
    await next();
  });
  app.get('/', async (c) => {
    const member = c.get('member');
    const [saved] = await services()
      .database.db.select()
      .from(onboarding)
      .where(eq(onboarding.memberId, member.id));
    const result = MeResponseSchema.parse({
      member: { id: member.id, displayName: member.displayName, email: member.email },
      access: {
        state: 'none',
        planLabel: null,
        capabilities: [],
        sourceAsAt: null,
        rulesVersion: null,
        hash: null,
      },
      onboarding: saved?.record ?? { version: 1, answers: {} },
    });
    const etag = `"${hash(result)}"`;
    c.header('ETag', etag);
    if (
      (c.req.header('if-none-match') ?? '')
        .split(',')
        .map((t) => t.trim())
        .some((t) => t === etag || t === `W/${etag}` || t === '*')
    )
      return c.body(null, 304);
    return c.json(result);
  });
  app.put('/onboarding', async (c) => {
    c.header('Cache-Control', 'no-store');
    const key = c.req.header('idempotency-key');
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Provide an Idempotency-Key of 8–128 letters, digits or ._:- characters.',
      );
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new AppError(400, 'INVALID_JSON', 'Provide a JSON onboarding record.');
    }
    const parsed = OnboardingRecordSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        400,
        'INVALID_ONBOARDING',
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    const member = c.get('member'),
      { db, transaction } = services().database;
    const response = await transaction(async () => {
      await db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.id, member.id))
        .for('update');
      const [stored] = await db
        .select()
        .from(idempotency)
        .where(and(eq(idempotency.memberId, member.id), eq(idempotency.key, key)));
      const requestHash = hash(parsed.data);
      if (stored) {
        if (stored.requestHash !== requestHash)
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was already used for a different onboarding record.',
          );
        return stored.response;
      }
      await db
        .insert(onboarding)
        .values({ memberId: member.id, record: parsed.data })
        .onConflictDoUpdate({
          target: onboarding.memberId,
          set: { record: parsed.data, updatedAt: new Date() },
        });
      await db
        .insert(idempotency)
        .values({ memberId: member.id, key, requestHash, response: parsed.data });
      return parsed.data;
    });
    return c.json(response);
  });
  return app;
}
