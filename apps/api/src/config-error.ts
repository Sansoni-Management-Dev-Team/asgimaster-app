const messages = {
  AUTH_ORIGIN: 'Use a canonical HTTPS origin for BETTER_AUTH_URL.',
  OUTBOX_KEY: 'OUTBOX_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.',
  DATABASE_TLS: 'DATABASE_URL must not contain SSL override parameters.',
  DATABASE_CA: 'Supply a readable, reviewed database CA bundle.',
  MAIL_TRANSPORT: 'Production requires SES transport.',
  INVALID_SETTINGS:
    'Required configuration is missing or invalid; check database, authentication and mail settings.',
} as const;
type ConfigCode = keyof typeof messages;
const codes = new WeakMap<Error, ConfigCode>();
export class ConfigError extends Error {
  constructor(code: ConfigCode) {
    super(messages[code]);
    codes.set(this, code);
  }
}
/** Never trust mutable Error.name/message, even for a ConfigError instance. */
export function configFailure(error: unknown) {
  const code = error instanceof Error ? codes.get(error) : undefined;
  return code ? { code, message: messages[code] } : undefined;
}
