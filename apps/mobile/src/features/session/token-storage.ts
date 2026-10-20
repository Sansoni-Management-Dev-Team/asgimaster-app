import * as SecureStore from 'expo-secure-store';
import type { Credentials } from './session-controller';
export const tokenStorage = {
  async get(key: string): Promise<Credentials | null> {
    const value = await SecureStore.getItemAsync(key);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('token' in parsed) ||
      typeof parsed.token !== 'string' ||
      !parsed.token
    )
      throw new Error('Saved sign-in could not be read.');
    return {
      token: parsed.token,
      expiresAt:
        'expiresAt' in parsed && typeof parsed.expiresAt === 'number'
          ? parsed.expiresAt
          : undefined,
      memberId:
        'memberId' in parsed && typeof parsed.memberId === 'string' ? parsed.memberId : undefined,
    };
  },
  set: (key: string, value: Credentials) =>
    SecureStore.setItemAsync(key, JSON.stringify(value), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
