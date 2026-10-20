import { Platform } from 'react-native';
import { memberCache } from './member-cache';
import { apiURL, validateAPIURL } from '@/lib/api-config';
import { queryClient } from '@/lib/query-client';
import { createSessionController } from './session-controller';
import { tokenStorage } from './token-storage';

let controller: ReturnType<typeof createSessionController> | undefined;
export function getSessionController() {
  if (!controller) {
    validateAPIURL(apiURL);
    controller = createSessionController({
      origin: apiURL,
      nativeOrigin: Platform.OS === 'web' ? null : 'mlaisansoni://',
      queryClient,
      storage: tokenStorage,
      cache: memberCache,
    });
  }
  return controller;
}
