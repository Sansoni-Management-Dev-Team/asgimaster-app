import { randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { html } from 'hono/html';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Services } from './services.js';
import { invites, members, outbox } from './db/schema.js';
import { AppError } from './errors.js';
import { isStaff, logAudit } from './identity.js';

const page = (title: string, content: unknown) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <title>${title} · Sansoni</title>
        <style>
          body {
            font: 16px system-ui;
            max-width: 64rem;
            margin: 3rem auto;
            padding: 0 1rem;
            color: #202020;
          }
          input,
          button {
            font: inherit;
            padding: 0.5rem;
            margin: 0.3rem;
          }
          label {
            display: block;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td,
          th {
            padding: 0.7rem;
            border-bottom: 1px solid #ddd;
            text-align: left;
          }
          form {
            margin: 1rem 0;
          }
          small {
            display: block;
            color: #555;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${content}
      </body>
    </html>`;
const same = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function adminRoutes(services: () => Services) {
  const app = new Hono<{
    Variables: { staffId: string; csrf: string; form: Record<string, string | File> };
  }>();
  app.use('*', async (c, next) => {
    const { config, auth } = services();
    c.header('Cache-Control', 'no-store');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
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
    if (c.req.method === 'POST') {
      const form = await c.req.parseBody();
      c.set('form', form);
      if (
        c.req.header('origin') !== config.url ||
        typeof form.csrf !== 'string' ||
        !same(csrf, form.csrf)
      )
        throw new AppError(403, 'CSRF_REJECTED', 'Refresh the form and try again.');
    }
    if (!['/admin/sign-in', '/admin/sign-in/verify'].includes(c.req.path)) {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.redirect('/admin/sign-in');
      if (
        !isStaff(session.user.role) ||
        session.session.authenticationMethod !== 'otp' ||
        !(await services().identity.eligible(session.user.id, false, true))
      )
        throw new AppError(403, 'STAFF_REQUIRED', 'Named staff access is required.');
      c.set('staffId', session.user.id);
    }
    await next();
  });
  const signInForm = (csrf: string, message = '') =>
    page(
      'Staff sign in',
      html`<p>${message}</p>
        <form method="post" action="/admin/sign-in">
          <input type="hidden" name="csrf" value="${csrf}" /><label
            >Staff email
            <input
              type="email"
              name="email"
              autocomplete="username"
              required
              maxlength="254" /></label
          ><button>Send sign-in code</button>
        </form>`,
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
    return c.html(
      page(
        'Enter sign-in code',
        html`<p>
            If this is a named staff account, a code has been queued. It expires in five minutes.
          </p>
          <form method="post" action="/admin/sign-in/verify">
            <input type="hidden" name="csrf" value="${c.get('csrf')}" /><input
              type="hidden"
              name="email"
              value="${email.data}"
            /><label
              >Email code
              <input
                name="otp"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6}"
                required /></label
            ><button>Sign in</button>
          </form>`,
      ),
    );
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
  app.get('/', async (c) => {
    const { db } = services().database;
    const rows = await db
      .select({ invite: invites, member: members })
      .from(invites)
      .innerJoin(members, eq(invites.memberId, members.id))
      .orderBy(desc(invites.createdAt))
      .limit(100);
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
    const token = c.get('csrf');
    return c.html(
      page(
        'Member invitations',
        html`<p>
            Invite eligible members, resend pending invitations, or revoke invitations that have not
            been accepted.
          </p>
          <form method="post" action="/admin/sign-out">
            <input type="hidden" name="csrf" value="${token}" /><button>Sign out</button>
          </form>
          <h2>Invite a member</h2>
          <form method="post" action="/admin/invites">
            <input type="hidden" name="csrf" value="${token}" /><label
              >Name <input name="displayName" required maxlength="80" /></label
            ><label>Email <input name="email" type="email" required maxlength="254" /></label
            ><label>Reason <input name="reason" required maxlength="500" /></label
            ><button>Invite member</button>
          </form>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                ({ invite, member }) =>
                  html`<tr>
                    <td>${member.displayName}<small>${member.email}</small></td>
                    <td>
                      ${invite.status === 'pending' && invite.expiresAt.getTime() <= Date.now() ? 'expired' : invite.status}<small
                        >Expires ${invite.expiresAt.toISOString()}</small
                      >
                    </td>
                    <td>
                      ${
                        invite.status === 'pending'
                          ? html`<form method="post" action="/admin/invites/${invite.id}/resend">
                                <input type="hidden" name="csrf" value="${token}" /><label
                                  >Reason <input name="reason" required maxlength="500" /></label
                                ><button>Resend</button>
                              </form>
                              <form method="post" action="/admin/invites/${invite.id}/revoke">
                                <input type="hidden" name="csrf" value="${token}" /><label
                                  >Reason <input name="reason" required maxlength="500" /></label
                                ><button>Revoke</button>
                              </form>`
                          : ''
                      }
                    </td>
                  </tr>`,
              )}
            </tbody>
          </table>
          <h2>Mail delivery attempts</h2>
          <p>
            Pending messages retry automatically. Sent means the email service accepted the message;
            it does not confirm inbox delivery. Ask the member to request a new code if it expires.
          </p>
          <table>
            <thead>
              <tr>
                <th>Message</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Failure</th>
              </tr>
            </thead>
            <tbody>
              ${messages.map(
                (m) =>
                  html`<tr>
                    <td>
                      ${m.kind}<small>${m.id}</small
                      ><small>Invite: ${m.inviteId ?? 'Returning or staff sign-in'}</small>
                    </td>
                    <td>${m.status}</td>
                    <td>${m.attempts}</td>
                    <td>${m.lastError ?? ''}</td>
                  </tr>`,
              )}
            </tbody>
          </table>`,
      ),
    );
  });
  const reason = (form: Record<string, string | File>) => {
    const value = z.string().trim().min(1).max(500).safeParse(form.reason);
    if (!value.success)
      throw new AppError(400, 'REASON_REQUIRED', 'Provide a reason of up to 500 characters.');
    return value.data;
  };
  app.post('/invites', async (c) => {
    const form = c.get('form'),
      input = z
        .object({ displayName: z.string().trim().min(1).max(80), email: z.email() })
        .safeParse(form);
    if (!input.success)
      throw new AppError(400, 'INVALID_MEMBER', 'Provide a name and valid email.');
    await services().inviteMember(
      c.get('staffId'),
      input.data.email,
      input.data.displayName,
      reason(form),
    );
    return c.redirect('/admin');
  });
  app.post('/invites/:id/resend', async (c) => {
    await services().resendInvite(c.get('staffId'), c.req.param('id'), reason(c.get('form')));
    return c.redirect('/admin');
  });
  app.post('/invites/:id/revoke', async (c) => {
    await services().identity.revokeInvite(
      c.get('staffId'),
      c.req.param('id'),
      reason(c.get('form')),
    );
    return c.redirect('/admin');
  });
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
  return app;
}
