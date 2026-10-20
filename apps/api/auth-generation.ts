// Schema-only configuration. Runtime config is in src/auth.ts.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/node-postgres';
import { admin, bearer, emailOTP, magicLink } from 'better-auth/plugins';
export const auth = betterAuth({
  database: drizzleAdapter(drizzle('postgres://schema-only'), { provider: 'pg' }),
  session: {
    additionalFields: {
      authenticationMethod: {
        type: 'string',
        required: true,
        defaultValue: 'unknown',
        input: false,
      },
    },
  },
  rateLimit: { enabled: true, storage: 'database' },
  plugins: [
    admin(),
    bearer(),
    magicLink({ disableSignUp: true, sendMagicLink: async () => {} }),
    emailOTP({ disableSignUp: true, sendVerificationOTP: async () => {} }),
  ],
});
