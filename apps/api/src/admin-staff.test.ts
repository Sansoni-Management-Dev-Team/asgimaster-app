import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './app.js';
import type { Services } from './services.js';
import { AppError } from './errors.js';

function fixture(role = 'admin', outage = false) {
  const calls: unknown[] = [];
  const services = {
    config: {
      url: 'http://localhost:8789',
      secret: 'isolated-staff-test-secret-at-least-thirty-two',
      production: false,
    },
    auth: {
      api: {
        getSession: async () => ({
          user: { id: 'actor', role },
          session: { authenticationMethod: 'otp' },
        }),
      },
    },
    identity: { eligible: async () => true },
    staffManagement: {
      requireAdmin: async () => {
        if (role !== 'admin')
          throw new AppError(403, 'ADMIN_REQUIRED', 'Admin access is required.');
      },
      list: async () => ({ rows: [], hasNext: false }),
      change: async (...args: unknown[]) => {
        calls.push(args);
        if (outage) throw new Error('private database error');
      },
    },
  } as unknown as Services;
  return { app: createApp({ services }), calls };
}
test('staff-only identities cannot view or mutate staff management and cannot see its navigation', async () => {
  const { app, calls } = fixture('staff');
  for (const path of ['/admin/staff', '/admin/staff/new', '/admin/staff/target/edit']) {
    assert.equal((await app.request(path)).status, 403);
    assert.equal((await app.request(path, { method: 'POST' })).status, 403);
  }
  assert.deepEqual(calls, []);
});
test('temporary failures preserve native and enhanced staff forms without leaking internal errors', async () => {
  for (const enhanced of [false, true]) {
    const { app, calls } = fixture('admin', true);
    const initial = await app.request('/admin/staff/new');
    const csrf = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
    const cookie = initial.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const response = await app.request('/admin/staff/new', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://localhost:8789',
        ...(enhanced
          ? { 'HX-Request': 'true', 'HX-Request-Type': 'partial', 'HX-Target': 'div#staff-add' }
          : {}),
      },
      body: new URLSearchParams({
        csrf,
        name: 'Retained Name',
        email: 'retained@example.test',
        role: 'staff',
        reason: 'Keep my reason',
      }),
    });
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /Keep my reason/);
    assert.match(body, /Retained Name/);
    assert.doesNotMatch(body, /private database error/);
    assert.equal(calls.length, 1);
    if (enhanced) assert.equal(response.headers.get('X-Staff-Form'), 'staff-add');
    else assert.match(body, /<!doctype html>/);
  }
});

test('self-removal leaves the privileged page through a full browser redirect', async () => {
  const { app } = fixture();
  const initial = await app.request('/admin/staff/new');
  const csrf = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
  const cookie = initial.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const response = await app.request('/admin/staff/actor/edit', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:8789',
      'HX-Request': 'true',
      'HX-Request-Type': 'partial',
      'HX-Target': 'div#staff-actor-edit',
    },
    body: new URLSearchParams({
      csrf,
      expectedRole: 'admin',
      role: 'user',
      reason: 'Hand over duties',
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('HX-Redirect'), '/admin/sign-in');
  assert.equal(response.headers.get('HX-Location'), null);
});
