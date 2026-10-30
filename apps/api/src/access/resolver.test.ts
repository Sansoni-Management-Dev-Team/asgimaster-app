import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import {
  AccessConflictError,
  canonicalJson,
  hashCanonical,
  maxAllowance,
  memberAccess,
  resolveAccess,
  ResolverInputError,
  type Correction,
  type ResolverInput,
} from './resolver.js';

// Synthetic rule set and defaults shared with the synthetic conformance suite.
const { defaults } = JSON.parse(
  readFileSync(new URL('./synthetic-suite.json', import.meta.url), 'utf8'),
) as { defaults: ResolverInput };
const at = '2030-01-14T23:00:00.000Z';
const base: ResolverInput = {
  ...defaults,
  sources: [
    {
      source: 'synthetic:au',
      asAt: at,
      records: [
        { ref: 'au-1', facts: { productHandle: 'synthetic-core', state: 'synthetic-active' } },
        { ref: 'au-2', facts: { productHandle: 'synthetic-pack', state: 'synthetic-active' } },
        { ref: 'au-3', facts: { productHandle: 'synthetic-other', state: 'synthetic-unmapped' } },
      ],
    },
    {
      source: 'synthetic:nz',
      asAt: '2030-01-14T20:00:00+10:00',
      records: [
        { ref: 'nz-1', facts: { state: 'synthetic-active', productHandle: 'synthetic-plus' } },
      ],
    },
  ],
};
const correction = (extra: Partial<Correction> = {}): Correction => ({
  id: 'c-1',
  memberId: 'synthetic-member-a',
  action: 'grant',
  capability: 'events',
  allowance: { kind: 'limited', amount: 1 },
  reason: 'Synthetic correction',
  recordedBy: 'synthetic-staff',
  recordedAt: '2030-01-01T00:00:00Z',
  expiresAt: '2030-04-01T00:00:00Z',
  ...extra,
});

test('resolution uses no clock or randomness', () => {
  const now = mock.method(Date, 'now', () => assert.fail('Date.now'));
  const random = mock.method(Math, 'random', () => assert.fail('Math.random'));
  try {
    assert.equal(resolveAccess(base).evaluatedAt, '2030-01-15T00:00:00.000Z');
  } finally {
    now.mock.restore();
    random.mock.restore();
  }
});

test('identical inputs in any order produce canonically identical output', () => {
  const first = resolveAccess(base);
  const shuffled: ResolverInput = {
    ...base,
    sources: [...base.sources].reverse().map((snapshot) => ({
      ...snapshot,
      records: [...snapshot.records].reverse().map((record) => ({
        ...record,
        facts: Object.fromEntries(Object.entries(record.facts).reverse()),
      })),
    })),
    rules: { ...base.rules, rules: [...base.rules.rules].reverse() },
  };
  const second = resolveAccess(shuffled);
  assert.equal(canonicalJson(second), canonicalJson(first));
  const { hash, ...rest } = first;
  assert.equal(hash, hashCanonical(rest));
  assert.match(hash, /^[0-9a-f]{64}$/);
  // A different evaluation time is a different result, even when access matches.
  const later = resolveAccess({ ...base, evaluatedAt: '2030-01-16T00:00:00Z' });
  assert.notEqual(later.hash, first.hash);
  assert.deepEqual(later.capabilities, first.capabilities);
});

test('results explain themselves by reference without copying source facts', () => {
  const resolution = resolveAccess(base);
  assert.equal(resolution.rulesVersion, 'synthetic-rules-1');
  assert.equal(resolution.oldestSourceAsAt, '2030-01-14T10:00:00.000Z');
  assert.deepEqual(resolution.sources, [
    { source: 'synthetic:au', asAt: at, records: ['au-1', 'au-2', 'au-3'] },
    { source: 'synthetic:nz', asAt: '2030-01-14T10:00:00.000Z', records: ['nz-1'] },
  ]);
  assert.equal(resolution.planLabel, 'Synthetic Plus');
  assert.deepEqual(resolution.labelProvenance, [
    { rule: 'plus', source: 'synthetic:nz', record: 'nz-1' },
  ]);
  assert.deepEqual(
    resolution.capabilities.find((c) => c.id === 'coaching'),
    {
      id: 'coaching',
      label: 'Coaching',
      unit: 'session',
      allowance: { kind: 'unknown', atLeast: 4 },
      until: null,
      grantedBy: [
        { kind: 'rule', rule: 'core', source: 'synthetic:au', record: 'au-1' },
        { kind: 'rule', rule: 'pack', source: 'synthetic:au', record: 'au-2' },
        { kind: 'rule', rule: 'plus', source: 'synthetic:nz', record: 'nz-1' },
      ],
    },
  );
  assert.deepEqual(
    resolution.stateProvenance.map((p) => p.record),
    ['au-1', 'au-2', 'nz-1'],
  );
  assert.deepEqual(resolution.diagnostics, {
    ungrantedRecords: [{ source: 'synthetic:au', record: 'au-3' }],
    unclassifiedRecords: [{ source: 'synthetic:au', record: 'au-3' }],
    missingFacts: [{ rule: 'pack', source: 'synthetic:au', record: 'au-2', fact: 'quantity' }],
  });
  const json = JSON.stringify(resolution);
  for (const fact of ['productHandle', 'synthetic-core', 'synthetic-active'])
    assert.ok(!json.includes(fact), fact);
});

test('the member projection carries no provenance, references or correction detail', () => {
  const resolution = resolveAccess({ ...base, corrections: [correction()] });
  const access = memberAccess(resolution);
  assert.deepEqual(Object.keys(access).sort(), [
    'capabilities',
    'hash',
    'planLabel',
    'rulesVersion',
    'sourceAsAt',
    'state',
  ]);
  assert.deepEqual(
    access.capabilities.find((c) => c.id === 'events'),
    {
      id: 'events',
      label: 'Events',
      unit: 'ticket',
      allowance: { kind: 'unlimited' },
      until: null,
    },
  );
  const later = resolveAccess({
    ...base,
    evaluatedAt: '2030-01-16T00:00:00Z',
    corrections: [correction()],
  });
  assert.notEqual(later.hash, resolution.hash);
  assert.equal(memberAccess(later).hash, access.hash);
  const json = JSON.stringify(access);
  for (const detail of ['au-1', 'c-1', 'Synthetic correction', 'synthetic-staff', 'core'])
    assert.ok(!json.includes(detail), detail);
});

test('a correction-only grant ends at its expiry; a rule grant has no window', () => {
  const coreOnly = {
    ...base,
    sources: [{ ...base.sources[0], records: [base.sources[0].records[0]] }],
  };
  const resolution = resolveAccess({
    ...coreOnly,
    corrections: [
      correction(),
      correction({ id: 'c-2', capability: 'coaching', allowance: { kind: 'limited', amount: 9 } }),
    ],
  });
  const byId = Object.fromEntries(resolution.capabilities.map((c) => [c.id, c]));
  assert.equal(byId.events.until, '2030-04-01T00:00:00.000Z');
  assert.deepEqual(byId.events.grantedBy, [
    { kind: 'correction', correction: 'c-1', expiresAt: '2030-04-01T00:00:00.000Z' },
  ]);
  assert.equal(byId.coaching.until, null);
  assert.deepEqual(byId.coaching.allowance, { kind: 'limited', amount: 9 });
  assert.deepEqual(
    resolution.corrections.map((c) => [c.id, c.effect]),
    [
      ['c-1', 'applied'],
      ['c-2', 'applied'],
    ],
  );
});

test('a replacing correction keeps the rule grant visible and open-ended', () => {
  const resolution = resolveAccess({
    ...base,
    rules: {
      ...base.rules,
      policies: { ...base.rules.policies, correctionWithRuleGrant: 'correction' },
    },
    corrections: [correction({ capability: 'events', allowance: { kind: 'limited', amount: 1 } })],
  });
  const events = resolution.capabilities.find((c) => c.id === 'events');
  assert.deepEqual(events?.allowance, { kind: 'limited', amount: 1 });
  assert.equal(events?.until, null);
  assert.deepEqual(
    events?.grantedBy.map((p) => p.kind),
    ['correction', 'rule'],
  );
});

test('a correction for a capability the rule set does not define is reported, not applied', () => {
  const resolution = resolveAccess({
    ...base,
    corrections: [correction({ capability: 'retired' })],
  });
  assert.equal(
    resolution.capabilities.find((c) => c.id === 'retired'),
    undefined,
  );
  assert.equal(resolution.corrections[0].effect, 'undefined_capability');
});

test('removals record the grants they override', () => {
  const resolution = resolveAccess({
    ...base,
    corrections: [correction({ capability: 'events', action: 'remove', allowance: undefined })],
  });
  assert.equal(
    resolution.capabilities.find((c) => c.id === 'events'),
    undefined,
  );
  assert.deepEqual(resolution.removed, [
    {
      id: 'events',
      correction: 'c-1',
      overrides: [{ kind: 'rule', rule: 'plus', source: 'synthetic:nz', record: 'nz-1' }],
    },
  ]);
});

test('conflicts identify corrections and grants without their reasons', () => {
  const error = (() => {
    try {
      resolveAccess({
        ...base,
        rules: {
          ...base.rules,
          policies: { mixedAllowances: 'reject', correctionWithRuleGrant: 'reject' },
        },
        corrections: [
          correction({ reason: 'SENTINEL-REASON' }),
          correction({ id: 'c-2', action: 'remove', allowance: undefined }),
          correction({
            id: 'c-3',
            capability: 'library',
            allowance: { kind: 'limited', amount: 1 },
          }),
        ],
      });
    } catch (caught) {
      return caught;
    }
  })();
  assert.ok(error instanceof AccessConflictError);
  assert.deepEqual(
    error.conflicts.map((conflict) => [conflict.kind, conflict.capability]),
    [
      ['corrections', 'events'],
      ['correction_with_rule_grant', 'library'],
      ['mixed_allowances', 'coaching'],
      ['mixed_allowances', 'library'],
    ],
  );
  assert.ok(!JSON.stringify(error.conflicts).includes('SENTINEL'));
  assert.ok(!error.message.includes('SENTINEL'));
});

test('invalid input is rejected with paths and messages, not values', () => {
  const invalid = (input: unknown, pattern: RegExp) =>
    assert.throws(
      () => resolveAccess(input as ResolverInput),
      (error) =>
        error instanceof ResolverInputError &&
        error.issues.some((issue) => pattern.test(issue)) &&
        !error.message.includes('SENTINEL'),
    );
  invalid({ ...base, evaluatedAt: 'SENTINEL' }, /^evaluatedAt:/);
  invalid({ ...base, evaluatedAt: undefined }, /^evaluatedAt:/);
  invalid({ ...base, corrections: [correction({ reason: ' ' })] }, /reason/);
  invalid(
    { ...base, corrections: [correction({ expiresAt: '2030-01-01T00:00:00Z' })] },
    /expire after/,
  );
  invalid({ ...base, corrections: [correction({ allowance: undefined })] }, /needs an allowance/);
  invalid({ ...base, corrections: [correction(), correction()] }, /unique/);
  invalid({ ...base, sources: [base.sources[0], base.sources[0]] }, /one snapshot/);
  const { policies: _, ...withoutPolicies } = base.rules;
  invalid({ ...base, rules: withoutPolicies }, /^rules\.policies:/);
  const rule = base.rules.rules[0];
  invalid(
    {
      ...base,
      rules: {
        ...base.rules,
        rules: [{ ...rule, grants: [{ capability: 'nope', allowance: { kind: 'unknown' } }] }],
      },
    },
    /undefined capability nope/,
  );
  invalid(
    {
      ...base,
      rules: {
        ...base.rules,
        rules: [rule, { ...rule, id: 'other', label: { text: 'Other', priority: 1 } }],
      },
    },
    /share priority 1/,
  );
  invalid(
    { ...base, rules: { ...base.rules, rules: [{ ...rule, match: { facts: {} } }] } },
    /at least one fact/,
  );
  invalid(
    { ...base, rules: { ...base.rules, states: { ...base.rules.states, precedence: ['none'] } } },
    /needs a precedence/,
  );
  invalid(
    {
      ...base,
      sources: [
        {
          source: 'synthetic:au',
          asAt: at,
          records: [{ ref: 'x', facts: { quantity: { nested: 'SENTINEL' } } }],
        },
      ],
    },
    /facts/,
  );
});

test('allowances combine by maximum and unknown never becomes a number', () => {
  const limited = (amount: number) => ({ kind: 'limited' as const, amount });
  assert.deepEqual(maxAllowance(limited(2), limited(3)), limited(3));
  assert.deepEqual(maxAllowance(limited(0), limited(0)), limited(0));
  assert.deepEqual(maxAllowance(limited(9), { kind: 'unlimited' }), { kind: 'unlimited' });
  assert.deepEqual(maxAllowance({ kind: 'unknown' }, { kind: 'unlimited' }), { kind: 'unlimited' });
  assert.deepEqual(maxAllowance({ kind: 'unknown' }, { kind: 'unknown' }), { kind: 'unknown' });
  assert.deepEqual(maxAllowance({ kind: 'unknown' }, limited(0)), { kind: 'unknown', atLeast: 0 });
  assert.deepEqual(maxAllowance({ kind: 'unknown', atLeast: 5 }, limited(2)), {
    kind: 'unknown',
    atLeast: 5,
  });
});

test('fact allowances accept only whole non-negative numbers', () => {
  const coaching = (quantity: unknown) => {
    const resolution = resolveAccess({
      ...base,
      sources: [
        {
          source: 'synthetic:au',
          asAt: at,
          records: [
            {
              ref: 'au-2',
              facts: {
                productHandle: 'synthetic-pack',
                state: 'synthetic-active',
                quantity,
              } as never,
            },
          ],
        },
      ],
    });
    return resolution.capabilities.find((c) => c.id === 'coaching')?.allowance;
  };
  assert.deepEqual(coaching(3), { kind: 'limited', amount: 3 });
  assert.deepEqual(coaching(0), { kind: 'limited', amount: 0 });
  for (const value of ['3', 1.5, -1, true, null])
    assert.deepEqual(coaching(value), { kind: 'unknown' });
});

test('canonical JSON sorts keys and omits undefined members', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: undefined, c: 'x' }] }), '{"a":[{"c":"x"}],"b":1}');
});
