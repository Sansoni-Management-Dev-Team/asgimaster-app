import type { MMKV } from 'react-native-mmkv';

// Separate from prototype storage, and loaded only for configured member sessions.
let storage: MMKV | undefined;
function memberStorage() {
  if (!storage) {
    // Native modules must not initialise when only prototype routes are mounted.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    storage = createMMKV({ id: 'sansoni.member-query-cache' });
  }
  return storage;
}
export const memberCache = {
  getItem: async (key: string) => memberStorage().getString(key) ?? null,
  setItem: async (key: string, value: string) => {
    memberStorage().set(key, value);
  },
  removeItem: async (key: string) => {
    memberStorage().remove(key);
  },
};
