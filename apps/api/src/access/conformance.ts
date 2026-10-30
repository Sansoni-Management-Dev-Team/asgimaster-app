import { z } from 'zod';
import {
  AccessConflictError,
  canonicalJson,
  memberStates,
  resolveAccess,
  ResolverInputError,
  type ResolverInput,
} from './resolver.js';

// A proposed, language-neutral case format (D-31 is unresolved). The client
// owns the acceptance suite; until an agreed pinned revision exists, passing
// these cases is not client-suite acceptance.
const allowance = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('limited'), amount: z.number().int().min(0) }),
  z.strictObject({ kind: z.literal('unlimited') }),
  z.strictObject({ kind: z.literal('unknown'), atLeast: z.number().int().min(0).optional() }),
]);
export const ConformanceSuiteSchema = z.strictObject({
  format: z.literal('access-conformance/proposed-1'),
  suite: z.string().min(1),
  revision: z.string().min(1),
  // `synthetic` cases are ours and illustrate configurable contracts. Only a
  // `client` suite at an agreed pinned revision can count as acceptance.
  origin: z.enum(['synthetic', 'client']),
  // Shallow defaults merged into each case input.
  defaults: z.record(z.string(), z.unknown()),
  cases: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        description: z.string().min(1),
        input: z.record(z.string(), z.unknown()),
        expect: z.union([
          z.strictObject({
            state: z.enum(memberStates),
            planLabel: z.string().nullable(),
            // Exactly these capabilities, with these allowances.
            capabilities: z.record(z.string(), allowance),
            until: z.record(z.string(), z.string().nullable()).optional(),
          }),
          z.strictObject({ rejected: z.enum(['input', 'conflict']) }),
        ]),
      }),
    )
    .min(1),
});
export type ConformanceSuite = z.infer<typeof ConformanceSuiteSchema>;
export type ConformanceResult = { id: string; failures: string[] };

// Runs every case and reports failures rather than skipping. Each case is also
// resolved with every input list reversed; the results must hash identically.
export function runConformanceSuite(raw: unknown): ConformanceResult[] {
  const suite = ConformanceSuiteSchema.parse(raw);
  return suite.cases.map((testCase) => {
    const input = { ...suite.defaults, ...testCase.input } as ResolverInput;
    const failures: string[] = [];
    const outcome = attempt(input);
    if ('rejected' in testCase.expect) {
      if (outcome.rejected !== testCase.expect.rejected)
        failures.push(`expected ${testCase.expect.rejected} rejection, got ${describe(outcome)}`);
      return { id: testCase.id, failures };
    }
    if (!outcome.resolution) return { id: testCase.id, failures: [`got ${describe(outcome)}`] };
    const { resolution } = outcome;
    const expected = testCase.expect;
    const check = (name: string, actual: unknown, wanted: unknown) => {
      if (canonicalJson(actual) !== canonicalJson(wanted))
        failures.push(`${name}: expected ${canonicalJson(wanted)}, got ${canonicalJson(actual)}`);
    };
    check('state', resolution.state, expected.state);
    check('planLabel', resolution.planLabel, expected.planLabel);
    check(
      'capabilities',
      Object.fromEntries(resolution.capabilities.map((c) => [c.id, c.allowance])),
      expected.capabilities,
    );
    for (const [capability, until] of Object.entries(expected.until ?? {}))
      check(
        `until.${capability}`,
        resolution.capabilities.find((c) => c.id === capability)?.until,
        until,
      );
    const reversed = attempt(reverseLists(input));
    if (reversed.resolution?.hash !== resolution.hash)
      failures.push('result depends on input order');
    return { id: testCase.id, failures };
  });
}

function attempt(input: ResolverInput) {
  try {
    return { resolution: resolveAccess(input) };
  } catch (error) {
    if (error instanceof ResolverInputError) return { rejected: 'input' as const };
    if (error instanceof AccessConflictError) return { rejected: 'conflict' as const };
    throw error;
  }
}

const describe = (outcome: ReturnType<typeof attempt>) =>
  outcome.resolution ? 'a resolution' : `${outcome.rejected} rejection`;

// Reverses every list whose order carries no meaning, and the key order of
// fact maps. State precedence is ordered by definition and stays as it is.
export function reverseLists(input: ResolverInput): ResolverInput {
  const facts = <T>(map: Record<string, T>) => Object.fromEntries(Object.entries(map).reverse());
  const match = (m: Match) => ({
    ...m,
    ...(m.sources && { sources: [...m.sources].reverse() }),
    facts: Object.fromEntries(
      Object.entries(m.facts)
        .reverse()
        .map(([name, allowed]) => [name, [...allowed].reverse()]),
    ),
  });
  return {
    ...input,
    sources: [...input.sources].reverse().map((snapshot) => ({
      ...snapshot,
      records: [...snapshot.records]
        .reverse()
        .map((record) => ({ ...record, facts: facts(record.facts) })),
    })),
    rules: {
      ...input.rules,
      capabilities: [...input.rules.capabilities].reverse(),
      rules: [...input.rules.rules].reverse().map((rule) => ({
        ...rule,
        match: match(rule.match),
        grants: [...rule.grants].reverse(),
      })),
      states: {
        ...input.rules.states,
        rules: [...input.rules.states.rules]
          .reverse()
          .map((rule) => ({ ...rule, match: match(rule.match) })),
      },
    },
    corrections: [...input.corrections].reverse(),
  };
}

type Match = ResolverInput['rules']['rules'][number]['match'];
