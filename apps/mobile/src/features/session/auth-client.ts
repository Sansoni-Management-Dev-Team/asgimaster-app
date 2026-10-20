import { createAuthClient } from 'better-auth/client';
import { emailOTPClient, magicLinkClient } from 'better-auth/client/plugins';
import type { SessionController } from './session-controller';

export function createNativeAuthClient(session: SessionController) {
  return createAuthClient({
    baseURL: session.origin,
    basePath: '/v1/auth',
    plugins: [emailOTPClient(), magicLinkClient()],
    fetchOptions: {
      credentials: 'omit',
      customFetchImpl: async (input, init) => {
        const url = new URL(String(input));
        if (url.origin !== new URL(session.origin).origin)
          throw new Error('Unexpected sign-in service.');
        return session.request(`${url.pathname}${url.search}`, init);
      },
    },
  });
}
export async function withNativeAuth(session: SessionController) {
  return createNativeAuthClient(session);
}
