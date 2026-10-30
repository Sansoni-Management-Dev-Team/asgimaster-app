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
          mechanism: { data: privateText },
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
