import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './app.js';
import { AppError } from './errors.js';
import type { Services } from './services.js';

const origin = 'http://localhost:3000';
function fixture(
  options: {
    signedIn?: boolean;
    role?: string;
    method?: string;
    fail?: boolean;
    relaxed?: boolean;
    production?: boolean;
  } = {},
) {
  const calls: unknown[] = [];
  const services = {
    config: {
      url: origin,
      secret: 'isolated-test-secret-at-least-thirty-two-characters',
      devRelaxAdminCsrf: options.relaxed,
      production: options.production,
    },
    auth: {
      api: {
        getSession: async () =>
          options.signedIn === false
            ? null
            : {
                user: { id: 'staff', role: options.role ?? 'staff' },
                session: { authenticationMethod: options.method ?? 'otp' },
              },
      },
    },
    identity: {
      eligible: async () => true,
      revokeInvite: async (...args: unknown[]) => calls.push(args),
    },
    memberDirectory: {
      list: async () => {
        if (options.fail) throw Error('private-member@example.test');
        return { rows: [], hasNext: false };
      },
      sources: async () => [],
    },
    inviteMember: async (...args: unknown[]) => {
      if (options.fail) throw Error('private-member@example.test');
      if (args[1] === 'conflict@example.test')
        throw new AppError(
          409,
          'INVITE_UNAVAILABLE',
          'This email cannot receive a new invitation.',
        );
      calls.push(args);
    },
    resendInvite: async (...args: unknown[]) => calls.push(args),
  } as unknown as Services;
  return { app: createApp({ services }), calls };
}

test('relaxed preview admin permits share/localhost origins and missing tokens without bypassing staff permissions', async () => {
  for (const requestOrigin of [
    'https://mactom--53187.getbb.app',
    'http://127.0.0.1:53187',
    'null',
    undefined,
  ]) {
    const { app, calls } = fixture({ relaxed: true });
    const response = await app.request('/admin/invites', {
      method: 'POST',
      headers: {
        ...(requestOrigin ? { origin: requestOrigin } : {}),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        displayName: 'Preview member',
        email: 'preview@example.test',
        reason: 'Local preview',
      }),
    });
    assert.equal(response.status, 302);
    assert.equal(calls.length, 1);
  }
  for (const options of [
    { relaxed: false },
    { relaxed: true, production: true },
    { relaxed: true, signedIn: false },
    { relaxed: true, role: 'user' },
    { relaxed: true, method: 'magic-link' },
  ]) {
    const { app, calls } = fixture(options);
    const response = await app.request('/admin/invites', {
      method: 'POST',
      headers: {
        origin: 'https://share.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        displayName: 'Preview',
        email: 'preview@example.test',
        reason: 'Local',
      }),
    });
    assert.equal(response.status, options.signedIn === false ? 302 : 403);
    assert.equal(calls.length, 0);
  }
});

test('public staff assets are explicit, locally packaged and independent of services', async () => {
  const app = createApp();
  for (const [path, type, marker] of [
    ['admin.css', 'text/css', ':root'],
    ['admin.js', 'text/javascript', 'htmx:before:swap'],
    ['htmx-4.0.0.min.js', 'text/javascript', '4.0.0'],
  ]) {
    const response = await app.request('/staff-assets/' + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, new RegExp(type));
    assert.match(await response.text(), new RegExp(marker));
    const head = await app.request('/staff-assets/' + path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await app.request('/staff-assets/' + path, { method: 'POST' })).status, 404);
  }
  for (const path of [
    '/staff-assets/package.json',
    '/staff-assets/admin.ts',
    '/staff-assets/%2e%2e/src/config.ts',
    '/staff-assets/missing',
  ])
    assert.equal((await app.request(path)).status, 404);
  assert.equal((await app.request('/health')).status, 200);
  assert.equal((await app.request('/')).status, 200);
});

test('full views, selected fragments and history restores have distinct safe representations', async () => {
  const { app } = fixture();
  for (const [headers, full] of [
    [{}, true],
    [{ 'HX-Request': 'false', 'HX-Target': 'section#member-results' }, true],
    [{ 'HX-Request': 'true', 'HX-Request-Type': 'partial', 'HX-Target': 'unexpected' }, true],
    [{ 'HX-Request': 'true', 'HX-Request-Type': 'full', 'HX-Target': 'div#staff-view' }, true],
    [{ 'HX-Request': 'true', 'HX-Request-Type': 'partial', 'HX-Target': 'div#staff-view' }, false],
    [
      { 'HX-Request': 'true', 'HX-Request-Type': 'partial', 'HX-Target': 'section#member-results' },
      false,
    ],
    [
      {
        'HX-Request': 'true',
        'HX-Request-Type': 'partial',
        'HX-Target': 'div#staff-view',
        'HX-History-Restore-Request': 'true',
      },
      true,
    ],
  ] as [Record<string, string>, boolean][]) {
    const response = await app.request('/admin/members?q=test&page=2', { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
      response.headers.get('vary')!,
      /HX-Request, HX-Request-Type, HX-Target, HX-History-Restore-Request/,
    );
    const csp = response.headers.get('content-security-policy')!;
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    const body = await response.text();
    assert.equal(body.includes('<!doctype html>'), full);
    assert.match(body, /id="member-results"/);
    assert.match(body, /<title>Members · Sansoni<\/title>/);
    if (full) {
      assert.match(body, /hx-boost:inherited="true"/);
      assert.match(body, /"history":"reload"/);
      assert.match(body, /"implicitInheritance":false/);
      assert.doesNotMatch(body, /<style|\son\w+=/);
    }
  }
});

test('enhanced expiry redirects the browser without a 3xx, and HX headers never grant staff access', async () => {
  for (const target of ['staff-view', 'member-results', 'invite-create']) {
    const response = await fixture({ signedIn: false }).app.request('/admin/members', {
      headers: {
        'HX-Request': 'true',
        'HX-Request-Type': 'partial',
        'HX-Target': `section#${target}`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('HX-Redirect'), '/admin/sign-in');
    assert.equal(await response.text(), '');
    const denied = await fixture({ role: 'user' }).app.request('/admin/members', {
      headers: {
        'HX-Request': 'true',
        'HX-Request-Type': 'partial',
        'HX-Target': `section#${target}`,
      },
    });
    assert.equal(denied.status, 200);
    assert.equal(denied.headers.get('HX-Redirect'), '/admin/members');
    const fullDenial = await fixture({ role: 'user' }).app.request('/admin/members');
    assert.equal(fullDenial.status, 403);
    assert.match(fullDenial.headers.get('content-type')!, /text\/html/);
  }
  const plain = await fixture({ signedIn: false }).app.request('/admin/members');
  assert.equal(plain.status, 302);
});

test('staff errors remain scoped HTML, preserve values and status, and enforce origin and CSRF', async () => {
  for (const enhanced of [false, true]) {
    const { app, calls } = fixture();
    const initial = await app.request('/admin/sign-in');
    const csrf = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
    const cookie = initial.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const post = (values: Record<string, string>, extra = {}, path = '/admin/invites') =>
      app.request(origin + path, {
        method: 'POST',
        headers: {
          cookie,
          origin,
          'content-type': 'application/x-www-form-urlencoded',
          ...(enhanced
            ? {
                'HX-Request': 'true',
                'HX-Request-Type': 'partial',
                'HX-Target': 'div#invite-create',
              }
            : {}),
          ...extra,
        },
        body: new URLSearchParams({ csrf, ...values }),
      });
    const values = { displayName: '<img src=x onerror=alert(1)>', email: 'invalid', reason: '   ' };
    const invalid = await post(values);
    assert.equal(invalid.status, 400);
    const body = await invalid.text();
    assert.match(body, /value="&lt;img/);
    assert.doesNotMatch(body, /<img|<script>alert/);
    assert.match(body, /aria-invalid="true"\s+aria-describedby="invite-create-email-error"/);
    assert.match(body, /value="invalid"/);
    assert.equal(invalid.headers.get('X-Staff-Form'), enhanced ? 'invite-create' : null);
    assert.equal(calls.length, 0);
    const valid = { displayName: 'Synthetic', email: 'test@example.test', reason: 'Test' };
    assert.equal((await post(valid, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post({ ...valid, csrf: 'bad' })).status, 403);
    assert.equal(calls.length, 0);
    assert.equal((await post({ ...valid, email: 'conflict@example.test' })).status, 409);
    const saved = await post(valid);
    assert.equal(saved.status, enhanced ? 204 : 302);
    if (enhanced)
      assert.equal(JSON.parse(saved.headers.get('HX-Location')!).path, '/admin?notice=created');
    assert.equal(calls.length, 1);
    for (const action of ['resend', 'revoke']) {
      const result = await post(
        { reason: 'A real reason' },
        enhanced ? { 'HX-Target': `div#invite-synthetic-${action}` } : {},
        `/admin/invites/synthetic/${action}`,
      );
      assert.equal(result.status, enhanced ? 204 : 302);
    }
    assert.equal(calls.length, 3);
  }
});

test('unexpected staff failures conceal sensitive exceptions and preserve a retryable form', async () => {
  const { app } = fixture({ fail: true });
  const initial = await app.request('/admin/sign-in');
  const csrf = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
  const response = await app.request(origin + '/admin/invites', {
    method: 'POST',
    headers: {
      origin,
      cookie: initial.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
      'HX-Request': 'true',
      'HX-Request-Type': 'partial',
      'HX-Target': 'div#invite-create',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      csrf,
      displayName: 'Retained',
      email: 'test@example.test',
      reason: 'Keep this reason',
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /Keep this reason/);
  assert.match(body, /Review invitations before trying again/);
  assert.doesNotMatch(body, /private-member/);
  const failedSearch = await app.request('/admin/members', {
    headers: {
      'HX-Request': 'true',
      'HX-Request-Type': 'partial',
      'HX-Target': 'section#member-results',
    },
  });
  assert.equal(failedSearch.status, 503);
  assert.equal(failedSearch.headers.get('X-Staff-Form'), null);
  assert.doesNotMatch(await failedSearch.text(), /private-member/);
});

test('expired or replaced CSRF cookies return retained invitation forms with a usable current token', async () => {
  for (const enhanced of [false, true]) {
    for (const action of ['create', 'resend', 'revoke']) {
      const { app, calls } = fixture();
      const initial = await app.request('/admin/sign-in');
      const oldToken = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
      const key = action === 'create' ? 'invite-create' : `invite-synthetic-${action}`;
      const path = action === 'create' ? '/admin/invites' : `/admin/invites/synthetic/${action}`;
      const values = {
        displayName: 'Retained stale name',
        email: 'stale@example.test',
        reason: 'Keep stale reason',
      };
      const post = (csrf: string, cookie = '', originHeader = origin) =>
        app.request(origin + path, {
          method: 'POST',
          headers: {
            origin: originHeader,
            cookie,
            'content-type': 'application/x-www-form-urlencoded',
            ...(enhanced
              ? {
                  'HX-Request': 'true',
                  'HX-Request-Type': 'partial',
                  'HX-Target': `div#${key}`,
                }
              : {}),
          },
          body: new URLSearchParams({ csrf, ...values }),
        });
      // Session is valid but the CSRF cookie has expired: no cookie is sent.
      const stale = await post(oldToken);
      assert.equal(stale.status, 403);
      assert.equal(calls.length, 0);
      const body = await stale.text();
      assert.match(body, /Nothing was saved/);
      assert.match(body, /Keep stale reason/);
      if (action === 'create') assert.match(body, /Retained stale name/);
      const freshToken = body.match(/name="csrf" value="([^"]+)"/)![1];
      assert.notEqual(freshToken, oldToken);
      const freshCookie = stale.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
      assert.equal(stale.headers.get('X-Staff-Form'), enhanced ? key : null);
      const rejectedOrigin = await post(freshToken, freshCookie, 'https://evil.example');
      assert.equal(rejectedOrigin.status, 403);
      assert.equal(rejectedOrigin.headers.get('X-Staff-Form'), null);
      assert.equal(calls.length, 0);
      const retry = await post(freshToken, freshCookie);
      assert.equal(retry.status, enhanced ? 204 : 302);
      assert.equal(calls.length, 1);
    }
  }
});

test('non-OTP and revoked-staff sessions get authoritative denial after enhanced navigation', async () => {
  for (const options of [{ role: 'user' }, { method: 'magic-link' }]) {
    const { app } = fixture(options);
    const enhanced = await app.request('/admin/members', {
      headers: {
        'HX-Request': 'true',
        'HX-Request-Type': 'partial',
        'HX-Target': 'div#staff-view',
      },
    });
    assert.equal(enhanced.status, 200);
    assert.equal(enhanced.headers.get('HX-Redirect'), '/admin/members');
    const full = await app.request(enhanced.headers.get('HX-Redirect')!);
    assert.equal(full.status, 403);
    assert.equal(full.headers.get('HX-Redirect'), null);
    assert.match(await full.text(), /Named staff access is required/);
  }
});
