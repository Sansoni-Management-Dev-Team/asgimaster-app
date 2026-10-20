import type { Credentials } from './session-controller';
// Browser preview credentials are memory-only. Native persistence uses SecureStore.
const credentials = new Map<string, Credentials>();
export const tokenStorage = {
  get: async (key: string) => credentials.get(key) ?? null,
  set: async (key: string, value: Credentials) => {
    credentials.set(key, value);
  },
  remove: async (key: string) => {
    credentials.delete(key);
  },
};
