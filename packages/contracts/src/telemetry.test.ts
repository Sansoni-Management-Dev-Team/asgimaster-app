import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportingEnvironment, scrubErrorEvent } from './telemetry.js';

test('only explicit deployment environments enable reporting', () => {
  for (const value of [undefined, '', 'staging', 'development', 'PRODUCTION'])
    assert.equal(reportingEnvironment(value), undefined);
  assert.equal(reportingEnvironment('develop'), 'develop');
  assert.equal(reportingEnvironment('production'), 'production');
});
test('outgoing allowlist removes synthetic credentials and personal data everywhere', () => {
  const privateText = 'Synthetic Member member@example.test Bearer secret-token';
  const event = {
    event_id: 'a'.repeat(32),
    timestamp: 123,
    message: privateText,
    user: { email: privateText },
    request: {
      url: `https://user:password@example.test/member/${privateText}?token=secret`,
      headers: { authorization: privateText, cookie: privateText },
      data: privateText,
      query_string: privateText,
    },
    breadcrumbs: [{ message: privateText, data: { url: privateText } }],
    extra: { body: privateText },
    contexts: { member: { name: privateText } },
    tags: { member: privateText },
    transaction: privateText,
    fingerprint: [privateText],
    exception: {
      values: [
        {
          type: privateText,
          value: privateText,
          mechanism: { type: privateText, data: privateText },
          stacktrace: {
            frames: [
              {
                filename: `/Users/${privateText}/index.js`,
                function: privateText,
                vars: { token: privateText },
              },
              {
                filename: `https://user:password@example.test/${privateText}.js?token=secret`,
                context_line: privateText,
              },
              { filename: 'app:///index.android.bundle', lineno: 42, colno: 9, in_app: true },
            ],
          },
        },
      ],
    },
    unknownFutureSDKField: privateText,
  };
  const result = scrubErrorEvent(event, 'develop');
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    privateText,
    'secret',
    'password',
    'example.test',
    '/Users/',
    'breadcrumbs',
    'headers',
    'unknownFuture',
  ])
    assert.ok(!serialized.includes(forbidden), forbidden);
  assert.equal(result.environment, 'develop');
  assert.equal(result.exception.values[0].type, 'Error');
  assert.deepEqual(result.exception.values[0].stacktrace.frames[2], {
    filename: 'app:///index.android.bundle',
    lineno: 42,
    colno: 9,
    in_app: true,
  });
  assert.equal(event.user.email, privateText); // No mutation of app/session state.
});

test('real device and container paths retain only fixed module/bundle names', () => {
  const inputs = [
    [
      '/private/var/containers/Bundle/Application/member-name/App.app/main.jsbundle',
      'app:///main.jsbundle',
    ],
    ['address at index.android.bundle', 'app:///index.android.bundle'],
    [
      'file:///data/user/0/member-name/files/main.jsbundle?token=secret#member',
      'app:///main.jsbundle',
    ],
    ['file:///repo/apps/api/dist/app.js', 'app:///dist/app.js'],
    ['/repo/apps/api/dist/observability.js', 'app:///dist/observability.js'],
    ['/repo/apps/api/dist/synthetic-member.js', '[Removed]'],
    ['https://user:secret@example.test/member-name.js?token=secret', '[Removed]'],
    ['/data/member/opaque-credential.hbc', '[Removed]'],
  ];
  const event = {
    exception: { values: [{ stacktrace: { frames: inputs.map(([filename]) => ({ filename })) } }] },
  };
  assert.deepEqual(
    scrubErrorEvent(event, 'develop').exception.values[0].stacktrace.frames.map((f) => f.filename),
    inputs.map(([, expected]) => expected),
  );
});
test('preserves bounded technical config and SDK identifiers, never arbitrary event metadata/names', () => {
  const debugId = '12345678-1234-4123-8123-123456789abc';
  const event = {
    release: 'synthetic@example.test',
    dist: 'secret',
    platform: 'synthetic-name',
    level: 'fatal',
    debug_meta: {
      images: [
        { type: 'sourcemap', debug_id: debugId, code_file: '/private/member/main.jsbundle' },
        { type: 'sourcemap', debug_id: 'secret', code_file: 'secret' },
      ],
    },
    exception: {
      values: [
        {
          type: 'SyntheticMember',
          mechanism: { type: 'synthetic@example.test', handled: false },
          stacktrace: {
            frames: [
              {
                filename: '/repo/apps/api/dist/app.js',
                function: 'synthetic@example.test',
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  };
  const result = scrubErrorEvent(event, 'production', {
    component: 'api',
    version: '1.2.3',
    commit: 'a'.repeat(40),
    buildNumber: '42',
  });
  assert.equal(result.level, 'fatal');
  assert.equal(result.release, `sansoni-api@1.2.3+${'a'.repeat(40)}`);
  assert.equal(result.dist, '42');
  assert.equal(result.platform, 'node');
  assert.deepEqual(result.debug_meta?.images, [
    { type: 'sourcemap', debug_id: debugId, code_file: 'app:///main.jsbundle' },
  ]);
  assert.deepEqual(result.exception.values[0].mechanism, { type: 'generic', handled: false });
  assert.ok(!JSON.stringify(result).includes('synthetic'));
  const invalid = scrubErrorEvent(event, 'develop', {
    component: 'mobile',
    version: 'member@example.test',
    commit: 'secret',
    buildNumber: 'member@example.test',
  });
  assert.equal(invalid.release, undefined);
  assert.equal(invalid.dist, undefined);
});
test('keeps newest causes and recent frames with bounded counts', () => {
  const values = Array.from({ length: 10 }, (_, i) => ({
    stacktrace: { frames: Array.from({ length: 60 }, (_, j) => ({ lineno: i * 100 + j })) },
  }));
  const result = scrubErrorEvent({ exception: { values } }, 'develop');
  assert.equal(result.exception.values.length, 5);
  assert.equal(result.exception.values[0].stacktrace.frames.length, 50);
  assert.equal(result.exception.values[0].stacktrace.frames[0].lineno, 510);
});
test('channel tagging wins over downloaded/local env; development cannot report as production', async () => {
  const { mobileReportingEnvironment } = await import('./telemetry.js');
  assert.equal(mobileReportingEnvironment('production', false, 'develop'), 'production');
  assert.equal(mobileReportingEnvironment('preview', false, 'production'), 'develop');
  assert.equal(mobileReportingEnvironment(null, true, 'develop'), 'develop');
  for (const channel of [null, 'unknown', 'member@example.test'])
    assert.equal(mobileReportingEnvironment(channel, false, 'production'), undefined);
  assert.equal(mobileReportingEnvironment('production', true, 'production'), undefined);
});

test('embedded/updates-disabled builds may use explicit build config; downloaded bundles need known native channel', async () => {
  const { mobileReportingEnvironment } = await import('./telemetry.js');
  assert.equal(mobileReportingEnvironment(null, false, 'production', true), 'production');
  assert.equal(mobileReportingEnvironment(null, false, 'develop', true), 'develop');
  assert.equal(mobileReportingEnvironment(null, false, 'production', false), undefined);
  assert.equal(mobileReportingEnvironment('unknown', false, 'production', true), undefined);
  assert.equal(mobileReportingEnvironment('preview', false, 'production', true), 'develop');
});
