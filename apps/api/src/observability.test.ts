import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/node';
import { initErrorReporting, reportError, flushErrorReporting } from './observability.js';
import { createApp } from './app.js';
import { AppError } from './errors.js';

test('real SDK transport receives only scrubbed synthetic errors with environment', async () => {
  const envelopes: unknown[] = [];
  initErrorReporting(
    { SENTRY_DSN: 'https://public@example.test/1', SENTRY_ENVIRONMENT: 'develop' },
    () => ({
      send: async (envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  );
  Sentry.setUser({ email: 'synthetic@example.test', id: 'synthetic-member' });
  Sentry.setContext('secret', { token: 'synthetic-token' });
  Sentry.addBreadcrumb({ message: 'synthetic-token' });
  reportError(new Error('synthetic@example.test Authorization: Bearer synthetic-token'));
  await flushErrorReporting();
  assert.equal(envelopes.length, 1);
  const wire = JSON.stringify(envelopes);
  for (const value of [
    'synthetic@example.test',
    'synthetic-member',
    'synthetic-token',
    'Authorization',
  ])
    assert.ok(!wire.includes(value), value);
  assert.ok(wire.includes('develop'));
  await Sentry.close();
});

test('health probes never call reporter; failures are reported without changing response', async () => {
  const reports: Error[] = [];
  const app = createApp({
    reportError: (error) => {
      reports.push(error);
      throw new Error('offline');
    },
  });
  app.get('/synthetic-error', () => {
    throw new Error('synthetic failure');
  });
  app.get('/synthetic-expected', () => {
    throw new AppError(401, 'UNAUTHORIZED', 'Sign in.');
  });
  app.get('/synthetic-unavailable', () => {
    throw new AppError(503, 'OFFLINE', 'Unavailable.');
  });
  for (const path of ['/', '/health']) assert.equal((await app.request(path)).status, 200);
  assert.equal(reports.length, 0);
  assert.equal((await app.request('/synthetic-expected')).status, 401);
  assert.equal(reports.length, 0);
  assert.equal((await app.request('/synthetic-error')).status, 503);
  assert.equal((await app.request('/synthetic-unavailable')).status, 503);
  assert.equal(reports.length, 2);
});

test('fatal exception and rejection logging never prints raw synthetic personal data', () => {
  for (const trigger of [
    "throw new Error('synthetic@example.test secret-token');",
    "Promise.reject(new Error('synthetic@example.test secret-token'));",
  ]) {
    const script = `import { installProcessErrorHandlers } from './src/observability.ts'; installProcessErrorHandlers(); ${trigger}`;
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'API process failed.');
    assert.equal(result.stdout, '');
  }
});
