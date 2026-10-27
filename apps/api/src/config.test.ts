import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rootCertificates } from 'node:tls';
import { Client } from 'pg';
import { loadConfig } from './config.js';

const production = {
  NODE_ENV: 'production',
  BETTER_AUTH_URL: 'https://api.example.test',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  MAIL_FROM: 'mail@example.test',
  DATABASE_URL: 'postgres://user:password@db.example.test/app',
  DATABASE_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'),
};
test('relaxed admin CSRF is opt-in and confined to capture-mail development', () => {
  assert.equal(loadConfig(production).devRelaxAdminCsrf, false);
  const development = { ...production, NODE_ENV: 'development', MAIL_TRANSPORT: 'capture' };
  assert.equal(loadConfig(development).devRelaxAdminCsrf, false);
  assert.equal(
    loadConfig({ ...development, DEV_RELAX_ADMIN_CSRF: 'true' }).devRelaxAdminCsrf,
    true,
  );
  for (const env of [
    production,
    { ...development, NODE_ENV: 'test' },
    { ...development, NODE_ENV: undefined },
    { ...development, MAIL_TRANSPORT: 'ses' },
  ])
    assert.throws(
      () => loadConfig({ ...env, DEV_RELAX_ADMIN_CSRF: 'true' }),
      /Relaxed admin CSRF requires/,
    );
});
test('optional membership credentials never prevent startup or imply connected sources', () => {
  assert.deepEqual(loadConfig(production).memberSources, {
    maxioAU: false,
    maxioNZ: false,
    hubspot: false,
  });
  assert.deepEqual(
    loadConfig({
      ...production,
      MAXIO_AU_API_KEY: 'example',
      MAXIO_NZ_API_KEY: ' ',
      HUBSPOT_ACCESS_TOKEN: 'example',
    }).memberSources,
    { maxioAU: true, maxioNZ: false, hubspot: true },
  );
});
test('production rejects pg URL options that override verified TLS', () => {
  for (const parameter of [
    'sslmode=disable',
    'sslmode=no-verify',
    'ssl=false',
    'sslrootcert=anything',
    'uselibpqcompat=true',
  ])
    assert.throws(() =>
      loadConfig({ ...production, DATABASE_URL: production.DATABASE_URL + '?' + parameter }),
    );
  const config = loadConfig(production),
    client = new Client(config.database);
  assert.equal(
    (client as unknown as { connectionParameters: { ssl: { rejectUnauthorized: boolean } } })
      .connectionParameters.ssl.rejectUnauthorized,
    true,
  );
  assert.throws(() => loadConfig({ ...production, DATABASE_CA_BASE64: '' }));
});
test('production rejects insecure auth origins, local transport and missing secrets', () => {
  assert.throws(() => loadConfig({ ...production, BETTER_AUTH_URL: 'http://api.example.test' }));
  assert.throws(() => loadConfig({ ...production, MAIL_TRANSPORT: 'capture' }));
  assert.throws(() => loadConfig({ ...production, OUTBOX_ENCRYPTION_KEY: 'short' }));
});

test('SES feedback address is optional and validates a single email mailbox', () => {
  assert.equal(loadConfig(production).mailFeedbackTo, undefined);
  assert.equal(
    loadConfig({ ...production, MAIL_FEEDBACK_TO: 'feedback@example.test' }).mailFeedbackTo,
    'feedback@example.test',
  );
  for (const address of [
    '',
    'invalid',
    'Name <feedback@example.test>',
    'a@example.test,b@example.test',
    'feedback@example.test\nBcc: other@example.test',
  ])
    assert.throws(() => loadConfig({ ...production, MAIL_FEEDBACK_TO: address }));
});
