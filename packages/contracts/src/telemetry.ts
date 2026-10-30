/** An explicit allowlist: free text and unknown SDK fields never leave the process. */
export type ReportingEnvironment = 'develop' | 'production';
export function reportingEnvironment(value: string | undefined): ReportingEnvironment | undefined {
  return value === 'develop' || value === 'production' ? value : undefined;
}

type Frame = { filename?: string; lineno?: number; colno?: number; in_app?: boolean };
type ErrorEvent = {
  event_id?: string;
  timestamp?: number;
  exception?: {
    values?: { type?: string; stacktrace?: { frames?: Frame[] } }[];
  };
};
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
]);
export function scrubErrorEvent(event: ErrorEvent, environment: ReportingEnvironment) {
  const position = (value: number | undefined) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  return {
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id)
      ? { event_id: event.event_id }
      : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
      ? { timestamp: event.timestamp }
      : {}),
    type: undefined,
    environment,
    level: 'error' as const,
    exception: {
      values: (event.exception?.values?.slice(0, 5) ?? [{}]).map((exception) => ({
        type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
        value: '[Removed for privacy]',
        stacktrace: {
          frames: (exception.stacktrace?.frames?.slice(-50) ?? []).map((frame) => ({
            // Only retain known application bundle names. Absolute paths can contain names,
            // URLs can contain credentials, and dynamic paths can identify members.
            filename: /^(?:app:\/\/\/)?(?:index(?:\.android|\.ios)?\.bundle|index\.js)$/.test(
              frame.filename ?? '',
            )
              ? frame.filename
              : '[Removed]',
            lineno: position(frame.lineno),
            colno: position(frame.colno),
            in_app: frame.in_app === true,
          })),
        },
      })),
    },
  };
}
