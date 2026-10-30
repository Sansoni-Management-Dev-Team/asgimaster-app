import { createOutageReporter } from './outage-reporting.js';
import { setTimeout } from 'node:timers/promises';
import type { Services } from './services.js';

export function startMailWorker(services: Services, reportError?: (error: Error) => void) {
  const abort = new AbortController();
  const outage = createOutageReporter(reportError);
  const done = (async () => {
    while (!abort.signal.aborted) {
      try {
        await services.mail.drain();
        outage.recovered();
      } catch (error) {
        if (outage.failed(error)) console.error('Email outbox poll failed. It will retry.');
      }
      try {
        await setTimeout(2000, undefined, { signal: abort.signal });
      } catch {
        /* Shutdown. */
      }
    }
  })();
  return { stop: () => abort.abort(), done };
}
