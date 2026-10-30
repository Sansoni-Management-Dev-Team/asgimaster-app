import { ConfigError } from './config-error.js';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { PoolConfig } from 'pg';
import type { SourceConfiguration } from './member-sources.js';

export type Config = {
  database: PoolConfig;
  url: string;
  secret: string;
  outboxKey: string;
  production: boolean;
  trustedProxyCidrs: string[];
  mailFrom: string;
  mailFeedbackTo?: string;
  mailTransport: 'capture' | 'ses';
  smtpHost: string;
  smtpPort: number;
  region: string;
  memberSources?: SourceConfiguration;
};
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    return readConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('INVALID_SETTINGS');
  }
}
function readConfig(env: NodeJS.ProcessEnv): Config {
  const production = env.NODE_ENV === 'production';
  const required = (key: string) => z.string().min(1).parse(env[key]);
  let url: URL;
  try {
    url = new URL(required('BETTER_AUTH_URL'));
  } catch {
    throw new ConfigError('AUTH_ORIGIN');
  }
  if (url.pathname !== '/' || (production && url.protocol !== 'https:'))
    throw new ConfigError('AUTH_ORIGIN');
  const secret = z.string().min(32).parse(env.BETTER_AUTH_SECRET);
  const outboxKey = z.string().min(32).parse(env.OUTBOX_ENCRYPTION_KEY);
  if (Buffer.from(outboxKey, 'base64').length !== 32) throw new ConfigError('OUTBOX_KEY');
  const database: PoolConfig = env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL }
    : {
        host: required('DATABASE_MAIN_HOST'),
        port: Number(required('DATABASE_MAIN_PORT')),
        database: required('DATABASE_MAIN_DATABASE'),
        user: required('DATABASE_MAIN_USERNAME'),
        password: required('DATABASE_MAIN_PASSWORD'),
      };
  if (production) {
    // pg connection-string SSL options override PoolConfig.ssl. Reject them so
    // URL query parameters cannot weaken certificate verification.
    if (
      env.DATABASE_URL &&
      [...new URL(env.DATABASE_URL).searchParams.keys()].some(
        (key) => /^ssl/i.test(key) || key.toLowerCase() === 'uselibpqcompat',
      )
    )
      throw new ConfigError('DATABASE_TLS');
    const ca = env.DATABASE_CA_FILE
      ? readFileSync(env.DATABASE_CA_FILE, 'utf8')
      : Buffer.from(required('DATABASE_CA_BASE64'), 'base64').toString('utf8');
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new ConfigError('DATABASE_CA');
    database.ssl = { rejectUnauthorized: true, ca };
  }
  const mailTransport = z
    .enum(['capture', 'ses'])
    .parse(env.MAIL_TRANSPORT ?? (production ? 'ses' : 'capture'));
  if (production && mailTransport !== 'ses') throw new ConfigError('MAIL_TRANSPORT');
  return {
    database,
    url: url.origin,
    secret,
    outboxKey,
    production,
    trustedProxyCidrs: (env.TRUSTED_PROXY_CIDRS ?? '').split(',').filter(Boolean),
    mailFrom: z.email().parse(env.MAIL_FROM),
    mailFeedbackTo: z.email().optional().parse(env.MAIL_FEEDBACK_TO),
    mailTransport,
    smtpHost: env.SMTP_HOST ?? '127.0.0.1',
    smtpPort: Number(env.SMTP_PORT ?? 51029),
    region: env.AWS_REGION ?? 'ap-southeast-2',
    memberSources: {
      maxioAU: Boolean(env.MAXIO_AU_API_KEY?.trim()),
      maxioNZ: Boolean(env.MAXIO_NZ_API_KEY?.trim()),
      hubspot: Boolean(env.HUBSPOT_ACCESS_TOKEN?.trim()),
    },
  };
}
