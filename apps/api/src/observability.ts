import { configFailure } from './config-error.js';
import * as Sentry from '@sentry/node';
import type { NodeOptions } from '@sentry/node';
import { reportingEnvironment, scrubErrorEvent } from '@mlai-sansoni/contracts/telemetry';

export function initErrorReporting(
  env: NodeJS.ProcessEnv = process.env,
  transport?: NodeOptions['transport'],
) {
  const environment = reportingEnvironment(env.SENTRY_ENVIRONMENT);
  if (!env.SENTRY_DSN || !environment) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    transport,
    environment,
    sendDefaultPii: false,
    // Avoid automatic request, database, console and local-variable collection.
    defaultIntegrations: false,
    integrations: [],
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => {
      const failure = configFailure(hint.originalException);
      return {
        ...scrubErrorEvent(event, environment, {
          component: 'api',
          version: env.SENTRY_VERSION,
          commit: env.SENTRY_COMMIT,
          buildNumber: env.SENTRY_DIST,
        }),
        ...(failure ? { tags: { configuration_error: failure.code } } : {}),
      };
    },
    beforeSendTransaction: () => null,
    enableLogs: false,
    sendClientReports: false,
  });
}
export function reportError(error: Error, fatal = false) {
  Sentry.captureException(error, {
    captureContext: { level: fatal ? 'fatal' : 'error' },
    mechanism: { type: 'generic', handled: !fatal },
  });
}
export async function flushErrorReporting() {
  await Sentry.flush(2000);
}

// SDK default fatal handlers print raw exceptions. Use a static local log instead.
export function installProcessErrorHandlers() {
  let exiting = false;
  const fatal = (error: unknown) => {
    if (exiting) process.exit(1);
    exiting = true;
    // Enforce a deadline even if a transport fails to honour its flush timeout.
    setTimeout(() => process.exit(1), 2500);
    const failure = configFailure(error);
    console.error(
      failure
        ? `API configuration failed [${failure.code}]: ${failure.message}`
        : 'API process failed.',
    );
    try {
      reportError(error instanceof Error ? error : new Error(), true);
    } catch {
      /* Best effort. */
    }
    void Sentry.close(2000).then(
      () => process.exit(1),
      () => process.exit(1),
    );
  };
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
}
