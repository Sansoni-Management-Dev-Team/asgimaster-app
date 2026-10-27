import { randomBytes, timingSafeEqual } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { html } from 'hono/html';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Services } from './services.js';
import { invites, members, outbox } from './db/schema.js';
import { AppError } from './errors.js';
import { isStaff, logAudit } from './identity.js';
import { adminCsp, enhanced, page, staffPage } from './admin-page.js';
import {
  invitationForm,
  invitationsView,
  mailDeliveryView,
  type FormErrors,
} from './admin-invitations.js';
import { APIError } from 'better-auth/api';
import { memberDirectoryRoutes } from './admin-members.js';

const same = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function adminRoutes(services: () => Services) {
  const app = new Hono<{
    Variables: { staffId: string; csrf: string; form: Record<string, string | File> };
  }>();
  const invitationSubject = async (id: string) => {
    if (!id) return '';
    const [record] = await services()
      .database.db.select({ member: members })
      .from(invites)
      .innerJoin(members, eq(invites.memberId, members.id))
      .where(eq(invites.id, id))
      .limit(1);
    if (!record) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invitation not found.');
    return `${record.member.displayName} · ${record.member.email}`;
  };
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Content-Security-Policy', adminCsp);
    c.header('Vary', 'HX-Request, HX-Request-Type, HX-Target, HX-History-Restore-Request');
    const { config, auth } = services();
    if (c.req.header('authorization'))
      throw new AppError(
        403,
        'STAFF_COOKIE_REQUIRED',
        'Staff access requires a browser cookie session.',
      );
    let csrf = await getSignedCookie(c, config.secret, 'sansoni.admin.csrf');
    if (!csrf) {
      csrf = randomBytes(32).toString('hex');
      await setSignedCookie(c, 'sansoni.admin.csrf', csrf, config.secret, {
        httpOnly: true,
        secure: config.production,
        sameSite: 'Strict',
        path: '/admin',
        maxAge: 3600,
      });
    }
    c.set('csrf', csrf);
    if (!['/admin/sign-in', '/admin/sign-in/verify'].includes(c.req.path)) {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) {
        // htmx ignores response instructions on redirects. A 200 instruction
        // navigates the entire browser instead of inserting login HTML.
        if (
          c.req.header('HX-Request') === 'true' ||
          c.req.header('HX-History-Restore-Request') === 'true'
        ) {
          c.header('HX-Redirect', '/admin/sign-in');
          return c.body(null, 200);
        }
        return c.redirect('/admin/sign-in');
      }
      if (
        !isStaff(session.user.role) ||
        session.session.authenticationMethod !== 'otp' ||
        !(await services().identity.eligible(session.user.id, false, true))
      ) {
        if (c.req.header('HX-Request') === 'true') {
          c.header('HX-Redirect', c.req.method === 'GET' ? c.req.path : '/admin');
          return c.body(null, 200);
        }
        throw new AppError(403, 'STAFF_REQUIRED', 'Named staff access is required.');
      }
      c.set('staffId', session.user.id);
    }
    if (c.req.method === 'POST') {
      const form = await c.req.parseBody();
      c.set('form', form);
      if (c.req.header('origin') !== config.url)
        throw new AppError(403, 'CSRF_REJECTED', 'Refresh the form and try again.');
      if (typeof form.csrf !== 'string' || !same(csrf, form.csrf)) {
        // Valid-origin stale forms recover without performing the mutation. The
        // response carries the current signed-cookie token and retained values.
        const invitation = c.req.path.match(/^\/admin\/invites(?:\/([^/]+)\/(resend|revoke))?$/);
        if (invitation) {
          const action = invitation[2] ?? 'create';
          const id = invitation[1] ? decodeURIComponent(invitation[1]) : '';
          const view = invitationForm(
            csrf,
            action,
            id,
            form,
            'Nothing was saved. This form expired. Your entries are kept; submit again.',
            {},
            await invitationSubject(id).catch(() => id),
          );
          const key = action === 'create' ? 'invite-create' : `invite-${id}-${action}`;
          if (enhanced(c) && c.req.header('HX-Target') === `div#${key}`) {
            c.header('X-Staff-Form', key);
            return c.html(view, 403);
          }
          return c.html(staffPage(c, 'Review invitation', view, csrf), 403);
        }
        throw new AppError(
          403,
          'CSRF_REJECTED',
          'Nothing was saved. Refresh the form and try again.',
        );
      }
    }
    await next();
  });
  const signInForm = (csrf: string, message = '', email = '', verify = false) =>
    page(
      verify ? 'Enter sign-in code' : 'Staff sign in',
      html` <p id="sign-in-error" class="${message ? 'error-summary' : ''}" role="alert">
          ${message}
        </p>
        ${verify ? html`<p>If this is a named staff account, a code has been queued. It expires in five minutes.</p>` : ''}
        <form method="post" action="${verify ? '/admin/sign-in/verify' : '/admin/sign-in'}">
          <input type="hidden" name="csrf" value="${csrf}" />
          ${
            verify
              ? html`<input type="hidden" name="email" value="${email}" /><label for="staff-code"
                    >Email code</label
                  >
                  <input
                    id="staff-code"
                    name="otp"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    pattern="[0-9]{6}"
                    required
                    aria-describedby="sign-in-error"
                  />`
              : html`<label for="staff-email">Staff email</label
                  ><input
                    id="staff-email"
                    type="email"
                    name="email"
                    value="${email}"
                    autocomplete="username"
                    required
                    maxlength="254"
                    aria-describedby="sign-in-error"
                  />`
          }
          <button>${verify ? 'Sign in' : 'Send sign-in code'}</button>
        </form>
        ${verify ? html`<p><a href="/admin/sign-in">Request a new sign-in code</a></p>` : ''}`,
    );
  app.get('/sign-in', (c) => c.html(signInForm(c.get('csrf'))));
  app.post('/sign-in', async (c) => {
    const form = c.get('form'),
      email = z.email().safeParse(form.email);
    if (!email.success) throw new AppError(400, 'INVALID_EMAIL', 'Enter your staff email.');
    // Eligibility remains generic here; the auth library gates both send and issue.
    await services().auth.api.sendVerificationOTP({
      headers: new Headers({ origin: services().config.url }),
      body: { email: email.data, type: 'sign-in' },
    });
    return c.html(signInForm(c.get('csrf'), '', email.data, true));
  });
  app.post('/sign-in/verify', async (c) => {
    const form = c.get('form'),
      parsed = z.object({ email: z.email(), otp: z.string().regex(/^\d{6}$/) }).safeParse(form);
    if (!parsed.success)
      throw new AppError(400, 'INVALID_CODE', 'Enter your email and six-digit code.');
    const login = await services().identity.byEmail(parsed.data.email);
    if (!login || !isStaff(login.role))
      throw new AppError(401, 'SIGN_IN_FAILED', 'Unable to sign in. Request a new code.');
    const response = await services().auth.api.signInEmailOTP({
      headers: new Headers({ origin: services().config.url }),
      body: parsed.data,
      asResponse: true,
    });
    if (!response.ok)
      throw new AppError(401, 'SIGN_IN_FAILED', 'Unable to sign in. Request a new code.');
    for (const cookie of response.headers.getSetCookie())
      c.header('Set-Cookie', cookie, { append: true });
    return c.redirect('/admin');
  });
  app.route('/members', memberDirectoryRoutes(services));
  app.get('/', async (c) => {
    const { db } = services().database;
    const rows = await db
      .select({ invite: invites, member: members })
      .from(invites)
      .innerJoin(members, eq(invites.memberId, members.id))
      .orderBy(desc(invites.createdAt))
      .limit(100);
    const notices: Record<string, string> = {
      created:
        'Invitation saved. Credentials are queued for delivery; membership access has not changed.',
      resent: 'Invitation resent. Replacement credentials are queued for delivery.',
      revoked: 'Invitation revoked. Outstanding invitation credentials are no longer valid.',
    };
    return c.html(
      staffPage(
        c,
        'Member invitations',
        invitationsView(rows, notices[c.req.query('notice') ?? ''] ?? ''),
        c.get('csrf'),
      ),
    );
  });
  app.get('/mail', async (c) => {
    const { db } = services().database;
    const messages = await db
      .select({
        id: outbox.id,
        inviteId: outbox.inviteId,
        kind: outbox.kind,
        status: outbox.status,
        attempts: outbox.attempts,
        lastError: outbox.lastError,
        createdAt: outbox.createdAt,
      })
      .from(outbox)
      .orderBy(desc(outbox.createdAt))
      .limit(100);
    return c.html(staffPage(c, 'Mail delivery', mailDeliveryView(messages), c.get('csrf')));
  });
  const formPage = async (c: import('hono').Context, action: string, id = '') => {
    const subject = await invitationSubject(id);
    const view = invitationForm(c.get('csrf'), action, id, {}, '', {}, subject);
    if (enhanced(c) && c.req.header('HX-Target') === 'div#staff-dialog-content') {
      c.header('X-Staff-Dialog', 'true');
      return c.html(view);
    }
    return c.html(staffPage(c, 'Invitation action', view, c.get('csrf')));
  };
  app.get('/invites/new', (c) => formPage(c, 'create'));
  app.get('/invites/:id/:action', (c) => {
    const action = c.req.param('action');
    if (!['resend', 'revoke'].includes(action))
      throw new AppError(404, 'NOT_FOUND', 'Action not found.');
    return formPage(c, action, c.req.param('id'));
  });
  for (const action of ['create', 'resend', 'revoke'] as const) {
    const path = action === 'create' ? '/invites' : `/invites/:id/${action}`;
    app.post(path, async (c) => {
      const form = c.get('form');
      const id = c.req.param('id') ?? '';
      const schema =
        action === 'create'
          ? z.object({
              displayName: z.string().trim().min(1).max(80),
              email: z.email(),
              reason: z.string().trim().min(1).max(500),
            })
          : z.object({ reason: z.string().trim().min(1).max(500) });
      const parsed = schema.safeParse(form);
      const errors: FormErrors = {};
      try {
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = String(issue.path[0]);
            errors[field] =
              field === 'email'
                ? 'Enter a valid email address.'
                : field === 'displayName'
                  ? 'Enter a name of up to 80 characters.'
                  : 'Provide a reason of up to 500 characters.';
          }
          throw new AppError(
            400,
            'INVALID_INVITATION',
            'Review the highlighted fields and try again.',
          );
        }
        const reason = parsed.data.reason;
        if (action === 'create') {
          const input = parsed.data as { email: string; displayName: string; reason: string };
          await services().inviteMember(c.get('staffId'), input.email, input.displayName, reason);
        } else if (action === 'resend') {
          await services().resendInvite(c.get('staffId'), id, reason);
        } else {
          await services().identity.revokeInvite(c.get('staffId'), id, reason);
        }
      } catch (error) {
        const known = error instanceof AppError;
        if (!known) console.error('Staff invitation action failed.');
        const message = known
          ? error.message
          : 'Unable to confirm this action. Your entries are kept. Review invitations before trying again.';
        const status = known ? error.status : 503;
        const view = invitationForm(
          c.get('csrf'),
          action,
          id,
          form,
          message,
          errors,
          await invitationSubject(id).catch(() => id),
        );
        const key = action === 'create' ? 'invite-create' : `invite-${id}-${action}`;
        if (enhanced(c) && c.req.header('HX-Target') === `div#${key}`) {
          c.header('X-Staff-Form', key);
          return c.html(view, status);
        }
        return c.html(
          staffPage(
            c,
            'Review invitation',
            html`${view}
              <p><a href="/admin">Review invitations and mail delivery</a></p>`,
            c.get('csrf'),
          ),
          status,
        );
      }
      const location =
        '/admin?notice=' + { create: 'created', resend: 'resent', revoke: 'revoked' }[action];
      if (enhanced(c)) {
        c.header(
          'HX-Location',
          JSON.stringify({
            path: location,
            target: '#staff-view',
            swap: 'outerHTML',
          }),
        );
        return c.body(null, 204);
      }
      return c.redirect(location);
    });
  }
  app.post('/sign-out', async (c) => {
    const result = await services().database.transaction(async () => {
      const response = await services().auth.api.signOut({
        headers: c.req.raw.headers,
        asResponse: true,
      });
      if (response.ok)
        await logAudit(
          services().database,
          c.get('staffId'),
          'staff.sign_out',
          c.get('staffId'),
          {},
        );
      return response;
    });
    if (!result.ok) throw new AppError(503, 'SIGN_OUT_FAILED', 'Sign-out failed. Try again.');
    for (const cookie of result.headers.getSetCookie())
      c.header('Set-Cookie', cookie, { append: true });
    return c.redirect('/admin/sign-in');
  });
  app.onError((error, c) => {
    const status =
      error instanceof AppError
        ? error.status
        : error instanceof APIError && error.statusCode < 500
          ? (error.statusCode as 400)
          : 503;
    if (status === 503) console.error('Staff request failed.');
    const message =
      error instanceof AppError
        ? error.message
        : status === 503
          ? 'This view is temporarily unavailable. Please try again.'
          : 'Unable to sign in. Request a new code and try again.';
    if (['/admin/sign-in', '/admin/sign-in/verify'].includes(c.req.path)) {
      const email = c.get('form')?.email;
      return c.html(
        signInForm(
          c.get('csrf'),
          message,
          typeof email === 'string' ? email.slice(0, 254) : '',
          c.req.path.endsWith('/verify'),
        ),
        status,
      );
    }
    const content = html`<p class="error-summary" role="alert" tabindex="-1">${message}</p>
      <p>
        <a href="/admin">Review invitations</a> ·
        <a href="/admin/members">Review member accounts</a> ·
        <a href="/admin/sign-in" hx-boost="false">Staff sign in</a>
      </p>`;
    return c.html(
      c.get('staffId')
        ? staffPage(c, 'Unable to complete request', content, c.get('csrf'))
        : page('Unable to complete request', content),
      status,
    );
  });
  return app;
}
