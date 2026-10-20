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
