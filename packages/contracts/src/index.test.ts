import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MeResponseSchema, OnboardingRecordSchema } from './index.js';

test('partial drafts, history and changed roles retain supported answers', () => {
  for (const answers of [
    {},
    { ownershipIntent: 'find-business' },
    { industry: 'Retail', role: 'Advisor', occupation: 'employee', incomeRange: '100-200k' },
    { rolePerspective: 'run-business', goal12Months: 'Grow' },
  ]) {
    assert.equal(OnboardingRecordSchema.safeParse({ version: 1, answers }).success, true);
  }
});
test('options, lengths, unknown fields and dependent income are validated', () => {
  for (const record of [
    { version: 2, answers: {} },
    { version: 1, name: 'a'.repeat(81), answers: {} },
    ...[
      { ownershipIntent: 'invented' },
      { industry: ' ' },
      { skills: 'a'.repeat(1001) },
      { rolePerspective: 'run-business', incomeRange: '300k+' },
      { incomeRange: '100-200k' },
      { memberId: 'other' },
    ].map((answers) => ({ version: 1, answers })),
  ]) {
    assert.equal(OnboardingRecordSchema.safeParse(record).success, false);
  }
  assert.equal(MeResponseSchema.safeParse({}).success, false);
});
