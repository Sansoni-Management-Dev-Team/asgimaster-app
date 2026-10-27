import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './app.js';
import type { Services } from './services.js';
import { createMemberSources, inspectSources } from './member-sources.js';

const member = {
  id: 'member-1',
  displayName: '<script>alert("name")</script>',
  email: 'member@example.test',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function fixture(role = 'admin', method = 'otp', signedIn = true) {
  const searches: unknown[] = [];
  const sources = createMemberSources();
  const services = {
    config: { secret: 'test-secret-with-at-least-thirty-two-characters', production: false },
    auth: {
      api: {
        getSession: async () =>
          signedIn
            ? {
                user: { id: 'staff-1', role },
                session: { authenticationMethod: method },
              }
            : null,
      },
    },
    identity: { eligible: async () => true },
    memberDirectory: {
      sources: () => inspectSources(sources),
      list: async (q: string, page: number) => {
        searches.push({ q, page });
        return { rows: q === 'missing' ? [] : [{ member, login: null }], hasNext: q !== 'missing' };
      },
      get: async (id: string) =>
        id === member.id
          ? {
              member,
              login: { established: true, disabled: false },
              sources: await inspectSources(sources, id),
              invitations: [
                {
                  status: 'pending',
                  createdAt: member.createdAt,
                  expiresAt: member.createdAt,
                },
              ],
            }
          : null,
    },
  } as unknown as Services;
  return { app: createApp({ services }), searches };
}

test('directory and details require staff OTP cookie sessions before reading accounts', async () => {
  for (const path of ['/admin/members', '/admin/members/member-1']) {
    for (const [role, method, signedIn, expected] of [
      ['admin', 'otp', false, 302],
      ['user', 'otp', true, 403],
      ['admin', 'magic-link', true, 403],
      ['staff', 'otp', true, 200],
    ] as const) {
      const { app, searches } = fixture(role, method, signedIn);
      const response = await app.request(path);
      assert.equal(response.status, expected);
      if (expected !== 200) assert.equal(searches.length, 0);
    }
    const response = await fixture().app.request(path, {
      headers: { authorization: 'Bearer member-token' },
    });
    assert.equal(response.status, 403);
  }
});

test('search escapes member and query content, preserves filters in pagination and labels source gaps', async () => {
  const { app, searches } = fixture();
  const q = '<img src=x onerror=alert(1)> &';
  const response = await app.request('/admin/members?' + new URLSearchParams({ q, page: '2' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  const body = await response.text();
  assert.deepEqual(searches, [{ q, page: 2 }]);
  assert.doesNotMatch(body, /<script>|<img/);
  assert.match(body, /&lt;script&gt;/);
  assert.match(body, /Maxio AU: Not connected/);
  assert.match(body, /Maxio NZ: Not connected/);
  assert.match(body, /HubSpot: Not connected/);
  assert.match(body, /not the authoritative Maxio/);
  assert.match(body, /page=3/);
  assert.match(body, /page=1/);
  assert.match(body, /q=%3Cimg/);
});

test('empty search, invalid parameters and unknown members have honest recoverable states', async () => {
  const { app, searches } = fixture();
  const empty = await app.request('/admin/members?q=missing');
  assert.match(await empty.text(), /No saved member accounts match/);
  for (const query of ['page=0', 'page=1.5', 'page=no', 'page=10001', 'q=' + 'a'.repeat(255)]) {
    assert.equal((await app.request('/admin/members?' + query)).status, 400);
  }
  assert.equal(searches.length, 1);
  assert.equal((await app.request('/admin/members/unknown')).status, 404);
  const detail = await app.request('/admin/members/member-1');
  const body = await detail.text();
  assert.match(body, /Login established/);
  assert.match(body, /Access is being set up/);
  assert.match(body, /expired/);
  assert.doesNotMatch(body, /<script>/);
});

test('stub source configuration and adapter failures never fabricate source records or expose errors', async () => {
  assert.deepEqual(
    (await inspectSources(createMemberSources())).map((s) => s.status),
    ['not_configured', 'not_configured', 'not_configured'],
  );
  const configured = createMemberSources({ maxioAU: true, maxioNZ: false, hubspot: true });
  assert.deepEqual(
    (await inspectSources(configured)).map((s) => s.status),
    ['not_connected', 'not_configured', 'not_connected'],
  );
  configured[0].inspect = async () => {
    throw new Error('secret-token@example.test');
  };
  const states = await inspectSources(configured, member.id);
  assert.equal(states[0].status, 'unavailable');
  assert.equal(states[2].status, 'not_connected');
  assert.doesNotMatch(JSON.stringify(states), /secret-token/);
});
