import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { mobileReportingEnvironment, scrubErrorEvent } from '@mlai-sansoni/contracts/telemetry';

const environment = mobileReportingEnvironment(
  Updates.channel,
  __DEV__,
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
  !Updates.isEnabled || Updates.isEmbeddedLaunch,
);
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn && environment) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    // Native crash events bypass JS beforeSend. Keep native reporting disabled
    // until native filtering has been implemented and verified in a release build.
    enableNative: false,
    enableNativeCrashHandling: false,
    defaultIntegrations: false,
    integrations: [Sentry.reactNativeErrorHandlersIntegration()],
    enableAutoSessionTracking: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event) =>
      scrubErrorEvent(event, environment, {
        component: 'mobile',
        version: Constants.expoConfig?.version,
      }),
    beforeSendTransaction: () => null,
    enableLogs: false,
    sendClientReports: false,
  });
}

export const withErrorReporting = Sentry.wrap;
