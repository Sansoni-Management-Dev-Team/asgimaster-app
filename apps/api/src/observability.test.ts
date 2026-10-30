import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/node';
import { initErrorReporting, reportError, flushErrorReporting } from './observability.js';
import { createApp } from './app.js';
import { AppError } from './errors.js';
import { ConfigError } from './config-error.js';

test('real SDK transport receives only scrubbed synthetic errors with environment', async () => {
  const envelopes: unknown[] = [];
  initErrorReporting(
    {
      SENTRY_DSN: 'https://public@example.test/1',
      SENTRY_ENVIRONMENT: 'develop',
      SENTRY_VERSION: '1.2.3',
      SENTRY_COMMIT: 'a'.repeat(40),
      SENTRY_DIST: '42',
    },
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
  const failure = new Error('synthetic@example.test Authorization: Bearer synthetic-token');
  failure.stack =
    'Error: synthetic@example.test\n at syntheticName (/repo/apps/api/dist/app.js:12:3)';
  reportError(failure, true);
  const configuration = new ConfigError('AUTH_ORIGIN');
  configuration.name = 'synthetic@example.test';
  configuration.message = 'synthetic-token';
  reportError(configuration);
  await flushErrorReporting();
  assert.equal(envelopes.length, 2);
  const wire = JSON.stringify(envelopes);
  for (const value of [
    'synthetic@example.test',
    'synthetic-member',
    'synthetic-token',
    'Authorization',
  ])
    assert.ok(!wire.includes(value), value);
  assert.ok(wire.includes('develop'));
  assert.ok(wire.includes('sansoni-api@1.2.3+'));
  assert.ok(wire.includes('app:///dist/app.js'));
  assert.ok(wire.includes('AUTH_ORIGIN'));
  assert.ok(wire.includes('"level":"fatal"'));
  assert.ok(wire.includes('"handled":false'));
  assert.ok(wire.includes('"handled":true'));
  assert.ok(!wire.includes('syntheticName'));
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

test('trusted configuration failure remains actionable even if Error fields are mutated', () => {
  const script = `import { installProcessErrorHandlers } from './src/observability.ts';
    import { ConfigError } from './src/config-error.ts';
    installProcessErrorHandlers();
    const error = new ConfigError('AUTH_ORIGIN');
    error.name = 'synthetic@example.test'; error.message = 'synthetic-token';
    throw error;`;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr.trim(),
    'API configuration failed [AUTH_ORIGIN]: Use a canonical HTTPS origin for BETTER_AUTH_URL.',
  );
});

test('fatal shutdown remains bounded when a transport ignores flush deadlines', () => {
  const script = `import { initErrorReporting, installProcessErrorHandlers } from './src/observability.ts';
    initErrorReporting({SENTRY_DSN:'https://public@example.test/1', SENTRY_ENVIRONMENT:'develop'}, () => ({ send: async () => ({statusCode:200}), flush: () => new Promise(() => {}) }));
    installProcessErrorHandlers();
    throw new Error('synthetic@example.test');`;
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^API process failed\.\n/);
  assert.ok(!result.stderr.includes('synthetic@example.test'));
  assert.ok(Date.now() - started < 4500);
});
