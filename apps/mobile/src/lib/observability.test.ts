import { beforeEach, expect, it, jest } from '@jest/globals';

const mockInit = jest.fn();
jest.mock('expo-updates', () => ({ channel: null }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));
jest.mock('@sentry/react-native', () => ({
  init: (options: unknown) => mockInit(options),
  wrap: (component: unknown) => component,
  reactNativeErrorHandlersIntegration: () => ({ name: 'ReactNativeErrorHandlers' }),
}));
beforeEach(() => {
  jest.resetModules();
  mockInit.mockClear();
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
});
it('does not initialize SDK without explicit DSN and deployment environment', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.test/1';
  jest.isolateModules(() => {
    jest.requireActual('./observability');
  });
  expect(mockInit).not.toHaveBeenCalled();
});
it('configures disabled native reporting and a scrub hook (SDK mocked; no device envelope verification)', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.test/1';
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = 'develop';
  jest.isolateModules(() => {
    jest.requireActual('./observability');
  });
  const options = mockInit.mock.calls[0][0] as {
    enableNative: boolean;
    enableNativeCrashHandling: boolean;
    sendDefaultPii: boolean;
    beforeSend: (event: object) => unknown;
    beforeBreadcrumb: () => unknown;
  };
  expect(options.enableNative).toBe(false);
  expect(options.enableNativeCrashHandling).toBe(false);
  expect(options.sendDefaultPii).toBe(false);
  expect(options.beforeBreadcrumb()).toBeNull();
  expect(
    JSON.stringify(
      options.beforeSend({
        message: 'synthetic@example.test',
        user: { email: 'synthetic@example.test' },
      }),
    ),
  ).not.toContain('synthetic@example.test');
});
