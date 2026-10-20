import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { createServices } from './services.js';
import { migrateDatabase } from './db/migrate.js';
import {
  audit,
  idempotency,
  invites,
  memberLogins,
  members,
  onboarding,
  outbox,
  rateLimit,
  session,
  user,
  verification,
} from './db/schema.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
test('Postgres auth/member vertical slice', { skip: !databaseUrl }, async (t) => {
  assert.match(
    new URL(databaseUrl!).pathname,
    /_test$/,
    'Only a dedicated *_test database may be reset',
  );
  const pool = new Pool({ connectionString: databaseUrl });
  const config: Config = {
    database: { connectionString: databaseUrl },
    url: 'http://localhost:3000',
    secret: 'local-integration-secret-at-least-thirty-two-chars',
    outboxKey: Buffer.alloc(32, 7).toString('base64'),
    production: false,
    trustedProxyCidrs: [],
    mailFrom: 'sansoni@example.test',
    mailTransport: 'capture',
    smtpHost: process.env.TEST_SMTP_HOST ?? '127.0.0.1',
    smtpPort: Number(process.env.TEST_SMTP_PORT ?? 51029),
    region: 'ap-southeast-2',
  };
  const captured: { to: string; subject: string; text: string }[] = [];
  const services = createServices(config, async (mail) => {
    captured.push(mail);
  });
  const { db } = services.database;
  let peer = 1;
  const app = createApp({
    services,
    peerAddress: (c) => c.req.header('x-test-peer') ?? `127.0.0.${(peer++ % 250) + 1}`,
  });
  const request = (
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    method = body === undefined ? 'GET' : 'POST',
  ) =>
    app.request(config.url + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const authRequest = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    request('/v1/auth' + path, body, headers);
  const latest = (email: string, kind: 'otp' | 'magic-link') => {
    const mail = captured
      .filter(
        (m) =>
          m.to === email &&
          (kind === 'otp' ? m.subject.includes('code') : !m.subject.includes('code')),
      )
      .at(-1);
    assert.ok(mail, `Expected captured ${kind} email`);
    const token =
      kind === 'otp'
        ? mail.text.match(/code is (\d{6})/)?.[1]
        : mail.text.match(/mlaisansoni:\/\/auth-callback\?token=([^\s]+)/)?.[1];
    assert.ok(token);
    return token;
  };
  const issueOTP = async (email: string) => {
    const before = captured.filter((m) => m.to === email && m.subject.includes('code')).length;
    const response = await authRequest('/email-otp/send-verification-otp', {
      email,
      type: 'sign-in',
    });
    assert.equal(response.status, 200);
    for (let attempt = 0; attempt < 100; attempt++) {
      await services.mail.drain(100);
      if (captured.filter((m) => m.to === email && m.subject.includes('code')).length > before)
        return latest(email, 'otp');
      await setTimeout(10);
    }
    assert.fail('A fresh queued OTP was not captured');
  };
  const loginOTP = async (email: string) => {
    const otp = await issueOTP(email);
    const response = await authRequest('/sign-in/email-otp', { email, otp });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const token = response.headers.get('set-auth-token');
    assert.ok(token);
    return { token, response, otp };
  };
  const invite = async (email: string) =>
    services.inviteMember(staffId, email, 'Synthetic member', 'Integration fixture');
  let staffId: string;
  let memberToken: string;
  let otherDeviceToken: string;
  let memberId: string;
  try {
    await t.test(
      'generated migrations apply cleanly, repeatedly and concurrently under lock',
      async () => {
        await pool.query('drop schema if exists public cascade');
        await pool.query('drop schema if exists drizzle cascade');
        await pool.query('create schema public');
        await migrateDatabase(pool);
        await Promise.all([migrateDatabase(pool), migrateDatabase(pool)]);
        const result = await pool.query(
          'select count(*)::int as n from drizzle.__drizzle_migrations',
        );
        assert.equal(result.rows[0].n, 2);
        staffId = (
          await services.identity.bootstrapStaff('staff@example.test', 'Named staff', 'admin')
        ).id;
      },
    );
    await t.test(
      'unknown accounts and library endpoints cannot register or send credentials',
      async () => {
        const before = await db.select().from(outbox);
        for (const path of ['/sign-in/magic-link', '/email-otp/send-verification-otp']) {
          const res = await authRequest(path, {
            email: 'unknown@example.test',
            type: 'sign-in',
            role: 'admin',
          });
          assert.equal(res.status, 200);
        }
        await services.auth.api.signInMagicLink({
          headers: new Headers(),
          body: { email: 'unknown@example.test' },
        });
        await services.auth.api.sendVerificationOTP({
          body: { email: 'unknown@example.test', type: 'sign-in' },
        });
        assert.equal((await db.select().from(outbox)).length, before.length);
        assert.equal(await services.identity.byEmail('unknown@example.test'), undefined);
        assert.equal(
          (
            await authRequest('/sign-up/email', {
              email: 'new@example.test',
              password: 'not-a-password',
              name: 'New',
              role: 'admin',
            })
          ).status,
          403,
        );
        await assert.rejects(() =>
          services.auth.api.createUser({
            body: { email: 'injected@example.test', name: 'Injected', role: 'admin' },
          }),
        );
        assert.equal(await services.identity.byEmail('injected@example.test'), undefined);
      },
    );
    await t.test(
      'invitations are linked, audited, idempotent and credentials encrypted/hashed',
      async () => {
        const first = await invite('member@example.test'),
          repeat = await invite('member@example.test');
        assert.equal(first.id, repeat.id);
        memberId = first.memberId;
        const [mapping] = await db
          .select()
          .from(memberLogins)
          .where(eq(memberLogins.memberId, memberId));
        assert.ok(mapping);
        assert.equal(mapping.established, false);
        const pending = await db.select().from(outbox).where(eq(outbox.userId, mapping.userId));
        assert.equal(pending.length, 2);
        assert.ok(
          pending.every((m) => m.encryptedPayload && !m.encryptedPayload.includes('mlaisansoni')),
        );
        await services.mail.drain(100);
        assert.equal(
          captured.length,
          2,
          JSON.stringify(captured.map((m) => ({ to: m.to, subject: m.subject }))),
        );
        const magic = latest('member@example.test', 'magic-link'),
          otp = latest('member@example.test', 'otp');
        const stored = await db.select().from(verification);
        assert.ok(stored.every((v) => !v.identifier.includes(magic) && !v.value.includes(otp)));
        assert.ok((await db.select().from(audit)).some((a) => a.action === 'invite.create'));
      },
    );
    await t.test(
      'exact native magic exchange returns JSON and signed usable bearer, single use',
      async () => {
        const magic = latest('member@example.test', 'magic-link');
        const response = await authRequest('/magic-link/verify?token=' + encodeURIComponent(magic));
        assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
        assert.equal(response.headers.get('location'), null);
        const body = (await response.json()) as {
          token: string;
          session: { token: string };
          user: { id: string; role: string };
        };
        memberToken = response.headers.get('set-auth-token')!;
        assert.ok(memberToken);
        assert.ok(memberToken.includes('.'));
        assert.equal(body.token, body.session.token);
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + memberToken })).status,
          200,
        );
        const replay = await authRequest('/magic-link/verify?token=' + encodeURIComponent(magic));
        assert.equal(replay.status, 401);
        const [accepted] = await db.select().from(invites).where(eq(invites.memberId, memberId));
        assert.equal(accepted.status, 'accepted');
        await assert.rejects(() =>
          services.identity.revokeInvite(staffId, accepted.id, 'Too late'),
        );
      },
    );
    await t.test(
      'OTP bearer login preserves other devices and returning members need no pending invite',
      async () => {
        const old = memberToken;
        otherDeviceToken = old;
        const logged = await loginOTP('member@example.test');
        memberToken = logged.token;
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + old })).status,
          200,
        );
        assert.equal(
          (
            await authRequest('/sign-in/email-otp', {
              email: 'member@example.test',
              otp: logged.otp,
            })
          ).status,
          401,
        );
        const cookie = logged.response.headers
          .getSetCookie()
          .map((v) => v.split(';')[0])
          .join('; ');
        assert.equal((await request('/admin', undefined, { cookie })).status, 403);
        assert.equal(
          (await request('/admin', undefined, { authorization: 'Bearer ' + memberToken })).status,
          403,
        );
        assert.equal(
          (
            await authRequest(
              '/update-user',
              { name: 'Changed', role: 'admin' },
              { authorization: 'Bearer ' + memberToken },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await authRequest(
              '/change-email',
              { newEmail: 'other@example.test' },
              { authorization: 'Bearer ' + memberToken },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await authRequest(
              '/admin/set-role',
              { userId: 'anything', role: 'admin' },
              { authorization: 'Bearer ' + memberToken },
            )
          ).status,
          403,
        );
        const login = await services.identity.byEmail('member@example.test');
        assert.equal(login!.role, 'user');
        assert.equal(login!.email, 'member@example.test');
      },
    );
    await t.test('invalid or other bearer cannot fall back to a valid member cookie', async () => {
      const logged = await loginOTP('member@example.test');
      const cookie = logged.response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
      for (const token of ['invalid.invalid', 'unsigned-session'])
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + token, cookie })).status,
          401,
        );
    });
    await t.test(
      'member ETag requires authentication, private caching and stable identity',
      async () => {
        const response = await request('/v1/me', undefined, {
          authorization: 'Bearer ' + memberToken,
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as { member: { id: string }; access: unknown };
        assert.equal(body.member.id, memberId);
        assert.deepEqual(body.access, {
          state: 'none',
          planLabel: null,
          capabilities: [],
          sourceAsAt: null,
          rulesVersion: null,
          hash: null,
        });
        assert.match(response.headers.get('cache-control')!, /private/);
        const etag = response.headers.get('etag')!;
        assert.ok(etag);
        assert.equal(
          (
            await request('/v1/me', undefined, {
              authorization: 'Bearer ' + memberToken,
              'if-none-match': etag,
            })
          ).status,
          304,
        );
        assert.equal((await request('/v1/me', undefined, { 'if-none-match': etag })).status, 401);
      },
    );
    await t.test(
      'onboarding validates drafts, dependent income and atomic idempotent retries',
      async () => {
        const headers = {
          authorization: 'Bearer ' + memberToken,
          'idempotency-key': 'draft-key-1',
        };
        const record = {
          version: 1,
          answers: {
            ownershipIntent: 'grow-business',
            industry: 'Technology',
            rolePerspective: 'run-business',
            incomeRange: '100-500k',
          },
        };
        const responses = await Promise.all(
          Array.from({ length: 4 }, () => request('/v1/me/onboarding', record, headers, 'PUT')),
        );
        for (const response of responses) {
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), record);
        }
        assert.equal((await db.select().from(idempotency)).length, 1);
        assert.equal((await db.select().from(onboarding)).length, 1);
        assert.equal(
          (await request('/v1/me/onboarding', { ...record, name: 'Different' }, headers, 'PUT'))
            .status,
          409,
        );
        const bad = [
          { version: 2, answers: {} },
          { version: 1, answers: { skills: 'x'.repeat(1001) } },
          { version: 1, answers: { rolePerspective: 'run-business', incomeRange: '300k+' } },
          { version: 1, answers: { memberId: 'other' } },
          { version: 1, answers: { industry: '' } },
        ];
        for (const body of bad)
          assert.equal(
            (
              await request(
                '/v1/me/onboarding',
                body,
                { ...headers, 'idempotency-key': 'invalid-key' },
                'PUT',
              )
            ).status,
            400,
          );
        assert.equal(
          (
            await request(
              '/v1/me/onboarding',
              record,
              { authorization: 'Bearer ' + memberToken },
              'PUT',
            )
          ).status,
          400,
        );
        const draft = { version: 1, answers: { ownershipIntent: 'explore-options' } };
        assert.equal(
          (
            await request(
              '/v1/me/onboarding',
              draft,
              { ...headers, 'idempotency-key': 'draft-key-2' },
              'PUT',
            )
          ).status,
          200,
        );
        // A delayed retry returns its own committed result without overwriting a newer draft.
        assert.deepEqual(
          await (await request('/v1/me/onboarding', record, headers, 'PUT')).json(),
          record,
        );
        assert.deepEqual(
          (
            (await (
              await request('/v1/me', undefined, { authorization: 'Bearer ' + memberToken })
            ).json()) as { onboarding: unknown }
          ).onboarding,
          draft,
        );
      },
    );
    await t.test(
      'second member has independent identity, onboarding, ETag and retry keys',
      async () => {
        await invite('second@example.test');
        const second = await loginOTP('second@example.test');
        const response = await request('/v1/me', undefined, {
          authorization: 'Bearer ' + second.token,
        });
        const body = (await response.json()) as { member: { id: string }; onboarding: unknown };
        assert.notEqual(body.member.id, memberId);
        assert.deepEqual(body.onboarding, { version: 1, answers: {} });
        assert.equal(
          (
            await request(
              '/v1/me/onboarding',
              { version: 1, name: 'Second', answers: {} },
              { authorization: 'Bearer ' + second.token, 'idempotency-key': 'draft-key-1' },
              'PUT',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request('/v1/me/' + memberId, undefined, {
              authorization: 'Bearer ' + second.token,
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      'revoked invite invalidates issued OTP and magic even after reinvite',
      async () => {
        const invitation = await invite('revoked@example.test');
        await services.mail.drain(100);
        const otp = latest('revoked@example.test', 'otp'),
          magic = latest('revoked@example.test', 'magic-link');
        await services.identity.revokeInvite(staffId, invitation.id, 'Test revocation');
        assert.equal(
          (await authRequest('/sign-in/email-otp', { email: 'revoked@example.test', otp })).status,
          401,
        );
        assert.equal((await authRequest('/magic-link/verify?token=' + magic)).status, 401);
        const count = (await db.select().from(outbox)).length;
        assert.equal(
          (
            await authRequest('/email-otp/send-verification-otp', {
              email: 'revoked@example.test',
              type: 'sign-in',
            })
          ).status,
          200,
        );
        assert.equal((await db.select().from(outbox)).length, count);
        await services.inviteMember(staffId, 'revoked@example.test', 'Synthetic', 'Reinvite', true);
        assert.equal(
          (await authRequest('/sign-in/email-otp', { email: 'revoked@example.test', otp })).status,
          401,
        );
        assert.equal((await authRequest('/magic-link/verify?token=' + magic)).status, 401);
        await services.mail.drain(100);
        const freshResponse = await authRequest('/sign-in/email-otp', {
          email: 'revoked@example.test',
          otp: latest('revoked@example.test', 'otp'),
        });
        assert.equal(freshResponse.status, 200);
        const fresh = { token: freshResponse.headers.get('set-auth-token')! };
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + fresh.token })).status,
          200,
        );
      },
    );
    await t.test(
      'invite revoke and redemption serialize atomically for OTP and magic',
      async () => {
        for (const kind of ['otp', 'magic-link'] as const) {
          const email = `race-${kind}@example.test`,
            invitation = await invite(email);
          await services.mail.drain(100);
          const credential = latest(email, kind);
          const [redeemed, revoked] = await Promise.allSettled([
            kind === 'otp'
              ? authRequest('/sign-in/email-otp', { email, otp: credential })
              : authRequest('/magic-link/verify?token=' + credential),
            services.identity.revokeInvite(staffId, invitation.id, 'Concurrent revoke'),
          ]);
          assert.equal(redeemed.status, 'fulfilled');
          const response = (redeemed as PromiseFulfilledResult<Response>).value;
          const [finalInvite] = await db
            .select()
            .from(invites)
            .where(eq(invites.id, invitation.id));
          const login = await services.identity.byEmail(email),
            [mapping] = await db
              .select()
              .from(memberLogins)
              .where(eq(memberLogins.userId, login!.id));
          const sessions = await db.select().from(session).where(eq(session.userId, login!.id));
          if (revoked.status === 'fulfilled') {
            assert.equal(finalInvite.status, 'revoked');
            assert.equal(response.status, 401);
            assert.equal(mapping.established, false);
            assert.equal(sessions.length, 0);
          } else {
            assert.equal(finalInvite.status, 'accepted');
            assert.equal(response.status, 200);
            assert.equal(mapping.established, true);
            assert.equal(sessions.length, 1);
          }
        }
      },
    );
    await t.test(
      'resending rotates pending invitation and invalidates old credentials',
      async () => {
        const invitation = await invite('resend@example.test');
        await services.mail.drain(100);
        const oldOTP = latest('resend@example.test', 'otp'),
          oldMagic = latest('resend@example.test', 'magic-link');
        const current = await services.resendInvite(staffId, invitation.id, 'Requested resend');
        assert.notEqual(current.id, invitation.id);
        assert.equal(
          (await authRequest('/sign-in/email-otp', { email: 'resend@example.test', otp: oldOTP }))
            .status,
          401,
        );
        assert.equal((await authRequest('/magic-link/verify?token=' + oldMagic)).status, 401);
        const pending = await db
          .select()
          .from(invites)
          .where(and(eq(invites.memberId, invitation.memberId), eq(invites.status, 'pending')));
        assert.equal(pending.length, 1);
      },
    );
    await t.test('expired OTP, magic and invitation cannot issue sessions', async () => {
      const invitation = await invite('expired@example.test');
      await services.mail.drain(100);
      const otp = latest('expired@example.test', 'otp'),
        magic = latest('expired@example.test', 'magic-link');
      await db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) });
      assert.equal(
        (await authRequest('/sign-in/email-otp', { email: 'expired@example.test', otp })).status,
        401,
      );
      assert.equal((await authRequest('/magic-link/verify?token=' + magic)).status, 401);
      const newOTP = await issueOTP('expired@example.test');
      await db
        .update(invites)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(invites.id, invitation.id));
      assert.equal(
        (await authRequest('/sign-in/email-otp', { email: 'expired@example.test', otp: newOTP }))
          .status,
        401,
      );
    });
    await t.test(
      'wrong OTP attempts persist through direct API errors and exhaust credential',
      async () => {
        await invite('attempts@example.test');
        await services.mail.drain(100);
        const otp = latest('attempts@example.test', 'otp');
        for (let i = 0; i < 3; i++)
          await assert.rejects(() =>
            services.auth.api.signInEmailOTP({
              body: { email: 'attempts@example.test', otp: '000000' === otp ? '111111' : '000000' },
              headers: new Headers(),
            }),
          );
        const [attempts] = await db
          .select()
          .from(verification)
          .where(eq(verification.identifier, 'sign-in-otp-attempts@example.test'));
        assert.ok(attempts.value.endsWith(':3'));
        const response = await authRequest('/sign-in/email-otp', {
          email: 'attempts@example.test',
          otp,
        });
        assert.equal(response.status, 401);
        const body = (await response.json()) as { error: { code: string } };
        assert.equal(body.error.code, 'SIGN_IN_FAILED');
      },
    );
    await t.test(
      'verification failures do not enumerate eligible or unknown identities',
      async () => {
        const unknown = await authRequest('/sign-in/email-otp', {
          email: 'enumeration-unknown@example.test',
          otp: '000000',
        });
        const known = await authRequest('/sign-in/email-otp', {
          email: 'staff@example.test',
          otp: '000000',
        });
        assert.equal(known.status, unknown.status);
        assert.deepEqual(await known.json(), await unknown.json());
      },
    );
    await t.test('concurrent OTP and magic redemption issue at most one session each', async () => {
      for (const kind of ['otp', 'magic-link'] as const) {
        const email = `concurrent-${kind}@example.test`;
        await invite(email);
        await services.mail.drain(100);
        const token = latest(email, kind);
        const results = await Promise.all(
          [0, 1].map(() =>
            kind === 'otp'
              ? authRequest('/sign-in/email-otp', { email, otp: token })
              : authRequest('/magic-link/verify?token=' + token),
          ),
        );
        assert.equal(results.filter((r) => r.status === 200).length, 1);
      }
    });
    await t.test('staff browser OTP login, CSRF, invitations and member boundary', async () => {
      const initial = await request('/admin/sign-in');
      assert.equal(initial.status, 200);
      const initialCookie = initial.headers
          .getSetCookie()
          .map((v) => v.split(';')[0])
          .join('; '),
        html = await initial.text(),
        csrf = html.match(/name="csrf" value="([^"]+)"/)![1];
      const formRequest = (path: string, body: Record<string, string>, cookie = initialCookie) =>
        app.request(config.url + path, {
          method: 'POST',
          headers: {
            origin: config.url,
            cookie,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ ...body, csrf }),
        });
      assert.equal(
        (await formRequest('/admin/sign-in', { email: 'staff@example.test' })).status,
        200,
      );
      await services.mail.drain(100);
      const otp = latest('staff@example.test', 'otp');
      const signedIn = await formRequest('/admin/sign-in/verify', {
        email: 'staff@example.test',
        otp,
      });
      assert.equal(signedIn.status, 302);
      const cookie =
        initialCookie +
        '; ' +
        signedIn.headers
          .getSetCookie()
          .map((v) => v.split(';')[0])
          .join('; ');
      const admin = await request('/admin', undefined, { cookie });
      assert.equal(admin.status, 200);
      const authSession = await services.auth.api.getSession({ headers: new Headers({ cookie }) });
      assert.equal(authSession!.user.role, 'admin');
      assert.equal((await request('/v1/me', undefined, { cookie })).status, 401);
      const staffToken = await services.auth.api.signInEmailOTP({
        body: { email: 'staff@example.test', otp: await issueOTP('staff@example.test') },
        headers: new Headers({ origin: config.url }),
        asResponse: true,
      });
      assert.equal(
        (
          await request('/v1/me', undefined, {
            authorization: 'Bearer ' + staffToken.headers.get('set-auth-token'),
          })
        ).status,
        403,
      );
      // Each independent staff session remains valid until explicitly revoked.
      const newCookie =
        initialCookie +
        '; ' +
        staffToken.headers
          .getSetCookie()
          .map((v) => v.split(';')[0])
          .join('; ');
      const rejected = await app.request(config.url + '/admin/invites', {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
          cookie: newCookie,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'csrf@example.test',
          displayName: 'CSRF',
          reason: 'No',
          csrf,
        }),
      });
      assert.equal(rejected.status, 403);
      const invalidCSRF = await app.request(config.url + '/admin/invites', {
        method: 'POST',
        headers: {
          origin: config.url,
          cookie: newCookie,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'csrf@example.test',
          displayName: 'CSRF',
          reason: 'No',
          csrf: 'é'.repeat(64),
        }),
      });
      assert.equal(invalidCSRF.status, 403);
      assert.equal(
        (
          await formRequest(
            '/admin/invites',
            {
              email: 'admin-invite@example.test',
              displayName: '<script>alert(1)</script>',
              reason: 'Named staff invitation',
            },
            newCookie,
          )
        ).status,
        302,
      );
      const view = await request('/admin', undefined, { cookie: newCookie });
      assert.ok((await view.text()).includes('&lt;script&gt;'));
      assert.equal((await formRequest('/admin/sign-out', {}, newCookie)).status, 302);
      assert.equal((await request('/admin', undefined, { cookie: newCookie })).status, 302);
    });
    await t.test(
      'named staff and member permissions can coexist only through explicit links',
      async () => {
        const staff = await services.identity.bootstrapStaff(
          'dual@example.test',
          'Dual permission',
          'staff',
        );
        assert.equal(
          (await db.select().from(memberLogins).where(eq(memberLogins.userId, staff.id))).length,
          0,
        );
        await services.inviteMember(staffId, staff.email, 'Dual member', 'Explicit member link');
        const signed = await loginOTP(staff.email);
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + signed.token })).status,
          200,
        );
        const cookie = signed.response.headers
          .getSetCookie()
          .map((v) => v.split(';')[0])
          .join('; ');
        assert.equal((await request('/admin', undefined, { cookie })).status, 200);
        const sent = await authRequest('/sign-in/magic-link', {
          email: staff.email,
          metadata: { authenticationMethod: 'otp' },
        });
        assert.equal(sent.status, 200);
        await services.mail.drain(100);
        const magic = latest(staff.email, 'magic-link');
        const magicSession = await authRequest('/magic-link/verify?token=' + magic);
        assert.equal(magicSession.status, 200);
        const magicBearer = magicSession.headers.get('set-auth-token')!,
          magicCookie = magicSession.headers
            .getSetCookie()
            .map((v) => v.split(';')[0])
            .join('; ');
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + magicBearer })).status,
          200,
        );
        assert.equal((await request('/admin', undefined, { cookie: magicCookie })).status, 403);
        const live = await services.auth.api.getSession({
          headers: new Headers({ authorization: 'Bearer ' + magicBearer }),
        });
        assert.equal(live!.session.authenticationMethod, 'magic-link');
        assert.equal((await request('/admin', undefined, { cookie })).status, 200);
        const staffOnlyBefore = (await db.select().from(outbox)).length;
        assert.equal(
          (await authRequest('/sign-in/magic-link', { email: 'staff@example.test' })).status,
          200,
        );
        assert.equal((await db.select().from(outbox)).length, staffOnlyBefore);
        const member = await services.identity.bootstrapStaff(
          'second@example.test',
          'Named member staff',
          'staff',
        );
        assert.equal(member.role, 'staff');
        const second = await loginOTP('second@example.test');
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + second.token })).status,
          200,
        );
      },
    );
    await t.test(
      'database rate limiting cannot be bypassed by forged forwarded headers',
      async () => {
        const responses = [];
        for (let i = 0; i < 4; i++)
          responses.push(
            await authRequest(
              '/email-otp/send-verification-otp',
              { email: `unknown${i}@example.test`, type: 'sign-in' },
              { 'x-test-peer': '127.0.0.250', 'x-forwarded-for': `198.51.100.${i}` },
            ),
          );
        assert.equal(responses.at(-1)!.status, 429);
      },
    );
    await t.test(
      'untrusted origins and redirects cannot deliver credentials or mutate cookie sessions',
      async () => {
        assert.equal(
          (
            await authRequest('/sign-in/magic-link', {
              email: 'member@example.test',
              callbackURL: 'https://evil.example/steal',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await authRequest(
              '/email-otp/send-verification-otp',
              { email: 'member@example.test', type: 'sign-in' },
              { origin: 'https://evil.example' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await authRequest('/email-otp/send-verification-otp', {
              email: 'member@example.test',
              type: 'email-verification',
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'session renewal persists expiry and exposes the signed bearer header',
      async () => {
        const active = await services.auth.api.getSession({
          headers: new Headers({ authorization: 'Bearer ' + otherDeviceToken }),
        });
        assert.ok(active);
        await db
          .update(session)
          .set({
            updatedAt: new Date(Date.now() - 2 * 86400000),
            expiresAt: new Date(Date.now() + 10 * 86400000),
          })
          .where(eq(session.id, active.session.id));
        const renewed = await authRequest('/get-session', undefined, {
          authorization: 'Bearer ' + otherDeviceToken,
        });
        assert.equal(renewed.status, 200);
        assert.ok(renewed.headers.get('set-auth-token'));
        const result = (await renewed.json()) as {
          session: { expiresAt: string; authenticationMethod: string };
        };
        assert.ok(new Date(result.session.expiresAt).getTime() > Date.now() + 29 * 86400000);
        assert.equal(result.session.authenticationMethod, 'magic-link');
      },
    );
    await t.test('production auth emits secure HttpOnly cookie sessions', async () => {
      const secure = createServices(
        { ...config, url: 'https://api.example.test', production: true },
        async (message) => {
          captured.push(message);
        },
      );
      try {
        const headers = new Headers({ origin: 'https://api.example.test' });
        await secure.auth.api.sendVerificationOTP({
          headers,
          body: { email: 'staff@example.test', type: 'sign-in' },
        });
        await secure.mail.drain(100);
        const response = await secure.auth.api.signInEmailOTP({
          headers,
          body: { email: 'staff@example.test', otp: latest('staff@example.test', 'otp') },
          asResponse: true,
        });
        assert.equal(response.status, 200);
        const cookie = response.headers
          .getSetCookie()
          .find((value) => value.includes('session_token='));
        assert.ok(cookie);
        assert.match(cookie, /; Secure/i);
        assert.match(cookie, /; HttpOnly/i);
        assert.match(cookie, /; SameSite=Lax/i);
      } finally {
        await secure.database.pool.end();
      }
    });
    await t.test(
      'sign-out revokes server session; cached profile cannot authorize a 304',
      async () => {
        const res = await authRequest('/sign-out', {}, { authorization: 'Bearer ' + memberToken });
        assert.equal(res.status, 200);
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + otherDeviceToken }))
            .status,
          200,
        );
        const active = await services.auth.api.getSession({
          headers: new Headers({ authorization: 'Bearer ' + otherDeviceToken }),
        });
        assert.ok(active);
        await db
          .update(session)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(session.id, active.session.id));
        assert.equal(
          (await request('/v1/me', undefined, { authorization: 'Bearer ' + otherDeviceToken }))
            .status,
          401,
        );
        const after = await request('/v1/me', undefined, {
          authorization: 'Bearer ' + memberToken,
          'if-none-match': '*',
        });
        assert.equal(after.status, 401);
      },
    );
    await t.test(
      'outbox records retries, terminal failure, expiry and clears encrypted credentials',
      async () => {
        const failing = createServices(config, async () => {
          throw new Error('sensitive credential should never be stored');
        });
        try {
          const invitation = await failing.inviteMember(
            staffId,
            'mail-failure@example.test',
            'Failure',
            'Test failure',
          );
          for (let i = 0; i < 5; i++) {
            await db
              .update(outbox)
              .set({ nextAttemptAt: new Date(0) })
              .where(and(eq(outbox.inviteId, invitation.id), eq(outbox.status, 'pending')));
            await failing.mail.drain(100);
          }
          const failures = await db.select().from(outbox).where(eq(outbox.inviteId, invitation.id));
          assert.ok(
            failures.every(
              (m) =>
                m.status === 'failed' &&
                m.attempts === 5 &&
                !m.encryptedPayload &&
                !m.lastError?.includes('sensitive'),
            ),
          );
          const expiring = await failing.inviteMember(
            staffId,
            'mail-expiry@example.test',
            'Expiry',
            'Test expiry',
          );
          await db
            .update(outbox)
            .set({ expiresAt: new Date(0) })
            .where(eq(outbox.inviteId, expiring.id));
          await failing.mail.drain(100);
          assert.ok(
            (await db.select().from(outbox).where(eq(outbox.inviteId, expiring.id))).every(
              (m) => m.status === 'expired' && !m.encryptedPayload,
            ),
          );
        } finally {
          await failing.database.pool.end();
        }
      },
    );
    await t.test('transaction rollback prevents partial member/invite/outbox writes', async () => {
      const [before] = await db.select({ count: sql<number>`count(*)::int` }).from(members);
      await assert.rejects(() =>
        services.database.transaction(async () => {
          await services.inviteMember(
            staffId,
            'rollback@example.test',
            'Rollback',
            'Test rollback',
          );
          throw new Error('rollback');
        }),
      );
      assert.equal(await services.identity.byEmail('rollback@example.test'), undefined);
      const [after] = await db.select({ count: sql<number>`count(*)::int` }).from(members);
      assert.equal(after.count, before.count);
    });
    await t.test('health probes survive a database outage and absent auth settings', async () => {
      const broken = createServices(
        {
          ...config,
          database: {
            connectionString: 'postgres://unavailable:unavailable@127.0.0.1:1/unavailable',
            connectionTimeoutMillis: 50,
          },
        },
        async () => {},
      );
      try {
        const probes = createApp({ services: broken });
        assert.equal((await probes.request('/')).status, 200);
        assert.equal((await probes.request('/health')).status, 200);
      } finally {
        await broken.database.pool.end();
      }
      assert.equal((await createApp().request('/health')).status, 200);
    });
    if (process.env.TEST_SMTP_PORT)
      await t.test(
        'real capture SMTP transport delivers a queued invitation to Mailpit',
        async () => {
          const smtp = createServices(config);
          try {
            await smtp.inviteMember(staffId, 'smtp@example.test', 'SMTP capture', 'SMTP proof');
            assert.ok(await smtp.mail.drain(100));
            const login = await smtp.identity.byEmail('smtp@example.test');
            const rows = await db.select().from(outbox).where(eq(outbox.userId, login!.id));
            assert.ok(rows.every((m) => m.status === 'sent'));
          } finally {
            await smtp.database.pool.end();
          }
        },
      );
  } finally {
    await services.database.pool.end();
    await pool.end();
  }
});
