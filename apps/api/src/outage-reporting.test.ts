import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOutageReporter } from './outage-reporting.js';

test('continuous outage sends one transition and bounded reminders, recovery resets immediately', () => {
  let now = 0;
  const reports: Error[] = [];
  const reporter = createOutageReporter(
    (error) => reports.push(error),
    () => now,
  );
  const failure = new Error('synthetic outage');
  for (now = 0; now < 60 * 60_000; now += 2000) reporter.failed(failure);
  assert.equal(reports.length, 12); // 1,800 failed polls produce 12 reports/hour/process.
  reporter.recovered();
  now = 60 * 60_000 - 1000;
  assert.equal(reporter.failed(failure), true);
  assert.equal(reports.length, 13);
  now += 299_999;
  assert.equal(reporter.failed(failure), false);
  now += 1;
  assert.equal(reporter.failed(failure), true);
});
test('reporter failures do not interrupt retry or bypass the reminder limit', () => {
  let calls = 0;
  const reporter = createOutageReporter(
    () => {
      calls++;
      throw new Error();
    },
    () => 0,
  );
  assert.equal(reporter.failed('synthetic'), true);
  assert.equal(reporter.failed('synthetic'), false);
  assert.equal(calls, 1);
  reporter.recovered();
  assert.equal(reporter.failed('synthetic'), true);
  assert.equal(calls, 2);
});
