import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './app.js';
import type { Services } from './services.js';

test('staff forms preserve their origin while auth exchanges retain no-referrer', async () => {
  const origin = 'http://localhost:8789';
  let requestedCodes = 0;
  const services = {
    config: {
      url: origin,
      secret: 'isolated-local-test-secret-at-least-thirty-two-chars',
      production: false,
      trustedProxyCidrs: [],
    },
    auth: {
      handler: async () => Response.json(null),
      api: { sendVerificationOTP: async () => requestedCodes++ },
    },
  } as unknown as Services;
  const app = createApp({ services });
  const initial = await app.request(origin + '/admin/sign-in');
  assert.equal(initial.headers.get('referrer-policy'), 'same-origin');
  const cookie = initial.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const csrf = (await initial.text()).match(/name="csrf" value="([^"]+)"/)![1];
  for (const requestOrigin of ['null', 'https://other.example', origin]) {
    const response = await app.request(origin + '/admin/sign-in', {
      method: 'POST',
      headers: {
        origin: requestOrigin,
        cookie,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrf, email: 'staff@example.test' }),
    });
    assert.equal(response.status, requestOrigin === origin ? 200 : 403);
  }
  assert.equal(requestedCodes, 1);
  const auth = await app.request(origin + '/v1/auth/get-session');
  assert.equal(auth.headers.get('referrer-policy'), 'no-referrer');
});
