import { Platform } from 'react-native';
import { memberCache } from './member-cache';
import { apiURL, resolveAPIURL } from '@/lib/api-config';
import { queryClient } from '@/lib/query-client';
import { createSessionController } from './session-controller';
import { tokenStorage } from './token-storage';

let controller: ReturnType<typeof createSessionController> | undefined;
export function getSessionController() {
  if (!controller) {
    const origin = resolveAPIURL(
      apiURL,
      Platform.OS,
      typeof window !== 'undefined' ? window.location?.origin : undefined,
    );
    controller = createSessionController({
      origin,
      nativeOrigin: Platform.OS === 'web' ? null : 'mlaisansoni://',
      queryClient,
      storage: tokenStorage,
      cache: memberCache,
    });
  }
  return controller;
}
