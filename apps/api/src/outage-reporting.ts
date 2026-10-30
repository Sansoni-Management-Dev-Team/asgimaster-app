/** Per-process outage transition + five-minute reminders, reset by a successful poll. */
export function createOutageReporter(
  reportError?: (error: Error) => void,
  now = () => performance.now(),
) {
  let lastReport: number | undefined;
  return {
    recovered() {
      lastReport = undefined;
    },
    failed(error: unknown) {
      const current = now();
      if (lastReport !== undefined && current - lastReport < 5 * 60_000) return false;
      lastReport = current;
      try {
        reportError?.(error instanceof Error ? error : new Error());
      } catch {
        /* Reporting must not block retry. */
      }
      return true;
    },
  };
}
