import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = require
  .resolve('@sentry/react-native/package.json', { paths: [join(process.cwd(), '../mobile')] })
  .replace(/package.json$/, '');

test('all EAS profiles disable unactivated uploads; installed iOS wrapper bundles without CLI/credentials', () => {
  const profiles = JSON.parse(
    readFileSync(new URL('../../mobile/eas.json', import.meta.url), 'utf8'),
  ).build;
  for (const profile of Object.values(profiles) as { env: Record<string, string> }[])
    assert.equal(profile.env.SENTRY_DISABLE_AUTO_UPLOAD, 'true');
  const temporary = mkdtempSync(join(tmpdir(), 'stu450-upload-'));
  try {
    const bundler = join(temporary, 'bundle.sh');
    writeFileSync(bundler, 'echo LOCAL_BUNDLE_OK\n');
    const result = spawnSync(
      '/bin/bash',
      [join(sdk, 'scripts/sentry-xcode.sh'), `/bin/sh ${bundler}`],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          PROJECT_DIR: temporary,
          DERIVED_FILE_DIR: temporary,
          SENTRY_DISABLE_AUTO_UPLOAD: 'true',
          SENTRY_CLI_EXECUTABLE: '/missing-cli',
          SENTRY_COLLECT_MODULES: '/missing-collector',
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /LOCAL_BUNDLE_OK/);
    assert.match(result.stdout, /skipping sourcemaps upload/);
  } finally {
    rmSync(temporary, { recursive: true });
  }
});
test('installed Android upload task is gated by the same disable variable (source contract, not a Gradle build)', () => {
  const gradle = readFileSync(join(sdk, 'sentry.gradle'), 'utf8');
  assert.match(
    gradle,
    /shouldSentryAutoUploadGeneral = \{ ->\s*return System.getenv\('SENTRY_DISABLE_AUTO_UPLOAD'\) != 'true'/,
  );
  assert.match(gradle, /onlyIf \{ shouldSentryAutoUploadGeneral\(\) \}/);
});
