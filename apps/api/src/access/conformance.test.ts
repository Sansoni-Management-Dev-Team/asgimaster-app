import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runConformanceSuite, type ConformanceSuite } from './conformance.js';

const synthetic: ConformanceSuite = JSON.parse(
  readFileSync(new URL('./synthetic-suite.json', import.meta.url), 'utf8'),
);

test('synthetic access cases (ours, not the client suite)', async (t) => {
  assert.equal(synthetic.origin, 'synthetic');
  for (const result of runConformanceSuite(synthetic))
    await t.test(result.id, () => assert.deepEqual(result.failures, []));
});

test('the runner reports a wrong expectation as a failure', () => {
  const [first] = synthetic.cases;
  const [result] = runConformanceSuite({
    ...synthetic,
    cases: [{ ...first, expect: { state: 'active', planLabel: null, capabilities: {} } }],
  });
  assert.deepEqual(result.failures, ['state: expected "active", got "none"']);
  const [rejection] = runConformanceSuite({
    ...synthetic,
    cases: [{ ...first, expect: { rejected: 'conflict' } }],
  });
  assert.deepEqual(rejection.failures, ['expected conflict rejection, got a resolution']);
});

// ENT-09 and STU-523: the client-owned suite at an agreed pinned revision must
// run here and block release on any failure. Its format and delivery are
// unresolved (D-31), so it is reported as outstanding, never as passing.
test.todo('pinned client access conformance suite');
