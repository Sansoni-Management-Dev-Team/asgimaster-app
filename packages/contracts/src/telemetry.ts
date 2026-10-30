/** An explicit allowlist: free text and unknown SDK fields never leave the process. */
export type ReportingEnvironment = 'develop' | 'production';
export function reportingEnvironment(value: string | undefined): ReportingEnvironment | undefined {
  return value === 'develop' || value === 'production' ? value : undefined;
}

/** Channel comes from native Updates config, not from the downloaded JS environment. */
export function mobileReportingEnvironment(
  channel: string | null,
  development: boolean,
  configured?: string,
  embedded = false,
) {
  if (development) return configured === 'develop' ? 'develop' : undefined;
  if (channel === 'production') return 'production';
  if (channel === 'preview' || channel === 'development') return 'develop';
  if (channel === null && embedded) return reportingEnvironment(configured);
  return undefined;
}

export type TechnicalMetadata = {
  // Callers supply deployment config, never event.release/dist or member state.
  component: 'api' | 'mobile';
  version?: string;
  commit?: string;
  buildNumber?: string;
};
export function technicalMetadata(config: TechnicalMetadata) {
  const version =
    config.version &&
    /^(?:0|[1-9]\d{0,2})\.(?:0|[1-9]\d{0,2})\.(?:0|[1-9]\d{0,2})$/.test(config.version)
      ? config.version
      : undefined;
  const commit = config.commit && /^[a-f0-9]{40}$/.test(config.commit) ? config.commit : undefined;
  const dist =
    config.buildNumber && /^[1-9]\d{0,8}$/.test(config.buildNumber)
      ? config.buildNumber
      : undefined;
  return {
    ...(version
      ? {
          release: `sansoni-${config.component === 'api' ? 'api' : 'mobile'}@${version}${commit ? `+${commit}` : ''}`,
        }
      : {}),
    ...(dist ? { dist } : {}),
    platform: config.component === 'api' ? 'node' : 'javascript',
  };
}

const bundles = new Set([
  'main.jsbundle',
  'index.bundle',
  'index.android.bundle',
  'index.ios.bundle',
  'index.js',
]);
// Fixed deployed API modules, never a caller-supplied basename or function name.
const apiModules = new Set([
  'app',
  'admin',
  'admin-assets',
  'admin-invitations',
  'admin-members',
  'admin-page',
  'admin-staff',
  'auth',
  'config',
  'config-error',
  'errors',
  'identity',
  'index',
  'mail',
  'mail-worker',
  'member',
  'member-directory',
  'member-sources',
  'observability',
  'operations',
  'outage-reporting',
  'services',
  'staff-management',
  'web',
]);
export function technicalFilename(value?: string) {
  if (!value || value.length > 2048) return '[Removed]';
  // Strip URL authority, directories, queries and fragments; only fixed names survive.
  const clean = value.replace(/^address at /, '').split(/[?#]/, 1)[0];
  const basename = clean.split('/').pop() ?? '';
  if (bundles.has(basename)) return `app:///${basename}`;
  const api = /^(?:file:\/\/)?\/repo\/apps\/api\/dist\/([a-z-]+)\.js$/.exec(clean);
  if (api && apiModules.has(api[1])) return `app:///dist/${api[1]}.js`;
  return '[Removed]';
}

type Frame = { filename?: string; lineno?: number; colno?: number; in_app?: boolean };
type ErrorEvent = {
  event_id?: string;
  timestamp?: number;
  level?: string;
  debug_meta?: { images?: { type?: string; debug_id?: string; code_file?: string }[] };
  exception?: {
    values?: {
      type?: string;
      mechanism?: { type: string; handled?: boolean };
      stacktrace?: { frames?: Frame[] };
    }[];
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
const mechanisms = new Set([
  'generic',
  'onerror',
  'onunhandledrejection',
  'auto.node.onuncaughtexception',
  'auto.node.onunhandledrejection',
]);
export function scrubErrorEvent(
  event: ErrorEvent,
  environment: ReportingEnvironment,
  config?: TechnicalMetadata,
) {
  const position = (value: number | undefined) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const images = event.debug_meta?.images?.slice(0, 20).flatMap((image) => {
    if (
      image.type !== 'sourcemap' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        image.debug_id ?? '',
      )
    )
      return [];
    const file = technicalFilename(image.code_file);
    if (file === '[Removed]' || !image.debug_id) return [];
    return [
      {
        type: 'sourcemap' as const,
        debug_id: image.debug_id,
        code_file: file,
      },
    ];
  });
  return {
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id)
      ? { event_id: event.event_id }
      : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
      ? { timestamp: event.timestamp }
      : {}),
    ...(config ? technicalMetadata(config) : {}),
    ...(images?.length ? { debug_meta: { images } } : {}),
    type: undefined,
    environment,
    level: event.level === 'fatal' ? ('fatal' as const) : ('error' as const),
    exception: {
      values: (event.exception?.values?.slice(-5) ?? [{}]).map((exception) => ({
        type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
        value: '[Removed for privacy]',
        ...(exception.mechanism && typeof exception.mechanism.handled === 'boolean'
          ? {
              mechanism: {
                type: mechanisms.has(exception.mechanism.type)
                  ? exception.mechanism.type
                  : 'generic',
                handled: exception.mechanism.handled,
              },
            }
          : {}),
        stacktrace: {
          frames: (exception.stacktrace?.frames?.slice(-50) ?? []).map((frame) => ({
            filename: technicalFilename(frame.filename),
            lineno: position(frame.lineno),
            colno: position(frame.colno),
            in_app: frame.in_app === true,
          })),
        },
      })),
    },
  };
}
