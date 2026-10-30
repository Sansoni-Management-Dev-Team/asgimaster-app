import { setTimeout } from 'node:timers/promises';
import type { Services } from './services.js';

export function startMailWorker(services: Services, reportError?: (error: Error) => void) {
  const abort = new AbortController();
  const done = (async () => {
    while (!abort.signal.aborted) {
      try {
        await services.mail.drain();
      } catch (error) {
        try {
          reportError?.(error instanceof Error ? error : new Error());
        } catch {
          /* Best effort. */
        }
        console.error('Email outbox poll failed. It will retry.');
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
