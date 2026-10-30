import { createHash } from 'node:crypto';
import { z } from 'zod';

// Access resolution is pure (CON-15): the result depends only on the explicit
// input below, including its evaluation time. Do not read a clock, randomness,
// configuration or the network here. Every business mapping (products,
// statuses, labels, allowances) arrives in the versioned rule set; this module
// must not know any upstream product or status name.

const id = z.string().trim().min(1).max(200);
const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

export const memberStates = [
  'active',
  'payment_issue',
  'none',
  'wind_down',
  'after_window',
] as const;
export type MemberState = (typeof memberStates)[number];

export const FactValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type FactValue = z.infer<typeof FactValueSchema>;

// One upstream record already linked to this member, such as one subscription.
// Ingestion supplies raw facts without business interpretation. A missing fact
// is absent or null, never a placeholder.
export const SourceRecordSchema = z.strictObject({
  ref: id,
  facts: z.record(id, FactValueSchema),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

export const SourceSnapshotSchema = z
  .strictObject({ source: id, asAt: instant, records: z.array(SourceRecordSchema) })
  .refine((snapshot) => unique(snapshot.records.map((record) => record.ref)), {
    message: 'Record references must be unique within a source.',
  });
export type SourceSnapshot = z.input<typeof SourceSnapshotSchema>;

const limited = z.strictObject({ kind: z.literal('limited'), amount: z.number().int().min(0) });
const unlimited = z.strictObject({ kind: z.literal('unlimited') });
const unknown = z.strictObject({ kind: z.literal('unknown') });
export const AllowanceSchema = z.discriminatedUnion('kind', [limited, unlimited, unknown]);
// A grant may take its amount from a numeric record fact. A missing or
// non-numeric fact yields an unknown allowance, never zero (ENT-04).
const GrantAllowanceSchema = z.discriminatedUnion('kind', [
  limited,
  unlimited,
  unknown,
  z.strictObject({ kind: z.literal('fact'), fact: id }),
]);
export type ResolvedAllowance =
  | { kind: 'limited'; amount: number }
  | { kind: 'unlimited' }
  // atLeast keeps a known amount that overlaps an unknown one: the larger of
  // the two is unknown but cannot be smaller than the known amount.
  | { kind: 'unknown'; atLeast?: number };

// A record matches when it comes from one of the listed sources (if any) and
// every named fact equals one of its allowed values. A missing fact never
// matches. At least one fact condition is required so a rule cannot match a
// whole source by accident.
const MatchSchema = z.strictObject({
  sources: z.array(id).min(1).optional(),
  facts: z
    .record(id, z.array(z.union([z.string(), z.number(), z.boolean()])).min(1))
    .refine((facts) => Object.keys(facts).length > 0, {
      message: 'A match needs at least one fact condition.',
    }),
});
type Match = z.infer<typeof MatchSchema>;

export const RuleSetSchema = z
  .strictObject({
    version: id,
    capabilities: z.array(
      z.strictObject({ id, label: z.string().trim().min(1).max(200), unit: id.optional() }),
    ),
    rules: z.array(
      z.strictObject({
        id,
        match: MatchSchema,
        grants: z.array(z.strictObject({ capability: id, allowance: GrantAllowanceSchema })),
        label: z
          .strictObject({ text: z.string().trim().min(1).max(200), priority: z.number().int() })
          .optional(),
      }),
    ),
    states: z.strictObject({
      rules: z.array(z.strictObject({ id, state: z.enum(memberStates), match: MatchSchema })),
      // Earlier states win when a member's records classify differently.
      precedence: z.array(z.enum(memberStates)),
    }),
    // Semantics the product has not agreed (see the access specification's
    // unresolved choices). Each rule set must choose; there is no default.
    // `reject` refuses to resolve the member so publication keeps last-good
    // access.
    policies: z.strictObject({
      // A known amount and an unknown allowance for one capability. `unknown`
      // keeps the result unknown with the known amount as a lower bound.
      mixedAllowances: z.enum(['reject', 'unknown']),
      // A correction grants a capability that rules also grant. `max` takes
      // the larger allowance; `correction` uses the correction's allowance
      // until it expires.
      correctionWithRuleGrant: z.enum(['reject', 'max', 'correction']),
    }),
  })
  .superRefine((ruleSet, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const capabilities = new Set(ruleSet.capabilities.map((capability) => capability.id));
    if (capabilities.size !== ruleSet.capabilities.length) issue('Capability ids must be unique.');
    if (!unique(ruleSet.rules.map((rule) => rule.id))) issue('Rule ids must be unique.');
    if (!unique(ruleSet.states.rules.map((rule) => rule.id)))
      issue('State rule ids must be unique.');
    if (!unique(ruleSet.states.precedence)) issue('State precedence must not repeat a state.');
    for (const rule of ruleSet.rules)
      for (const grant of rule.grants)
        if (!capabilities.has(grant.capability))
          issue(`Rule ${rule.id} grants undefined capability ${grant.capability}.`);
    for (const rule of ruleSet.states.rules)
      if (!ruleSet.states.precedence.includes(rule.state))
        issue(`State ${rule.state} needs a precedence.`);
    const labels = new Map<number, string>();
    for (const { label } of ruleSet.rules) {
      if (!label) continue;
      if ((labels.get(label.priority) ?? label.text) !== label.text)
        issue(`Different labels share priority ${label.priority}.`);
      labels.set(label.priority, label.text);
    }
  });
export type RuleSet = z.input<typeof RuleSetSchema>;

// Corrections are append-only. An amendment is a new record that supersedes an
// earlier one. Reason and expiry are mandatory (ENT-06, CON-17).
export const CorrectionSchema = z
  .strictObject({
    id,
    memberId: id,
    action: z.enum(['grant', 'remove']),
    capability: id,
    allowance: AllowanceSchema.optional(),
    reason: z.string().trim().min(1).max(1000),
    recordedBy: id,
    recordedAt: instant,
    effectiveFrom: instant.optional(),
    expiresAt: instant,
    supersedes: id.optional(),
  })
  .refine(
    (correction) => (correction.action === 'grant') === (correction.allowance !== undefined),
    {
      message: 'A grant needs an allowance and a removal must not have one.',
    },
  )
  .refine(
    (correction) => correction.expiresAt > (correction.effectiveFrom ?? correction.recordedAt),
    {
      message: 'A correction must expire after it takes effect.',
    },
  );
export type Correction = z.input<typeof CorrectionSchema>;

export const ResolverInputSchema = z
  .strictObject({
    memberId: id,
    evaluatedAt: instant,
    sources: z.array(SourceSnapshotSchema),
    rules: RuleSetSchema,
    corrections: z.array(CorrectionSchema),
  })
  .refine((input) => unique(input.sources.map((snapshot) => snapshot.source)), {
    message: 'Each source may supply only one snapshot.',
  })
  .refine((input) => unique(input.corrections.map((correction) => correction.id)), {
    message: 'Correction ids must be unique.',
  });
export type ResolverInput = z.input<typeof ResolverInputSchema>;

export type Provenance =
  | { kind: 'rule'; rule: string; source: string; record: string }
  | { kind: 'correction'; correction: string; expiresAt: string };
type RecordProvenance = { rule: string; source: string; record: string };
type RecordRef = { source: string; record: string };

// The full, staff-facing result. It names rules, records and corrections by
// reference only and never copies source facts. Members receive memberAccess().
export type Resolution = {
  memberId: string;
  evaluatedAt: string;
  rulesVersion: string;
  state: MemberState;
  stateProvenance: RecordProvenance[];
  planLabel: string | null;
  labelProvenance: RecordProvenance[];
  capabilities: {
    id: string;
    label: string;
    unit: string | null;
    allowance: ResolvedAllowance;
    // Set only when a correction alone grants the capability. A correction
    // that overlaps a rule grant never puts an end date on the rule grant.
    until: string | null;
    // Every grant, including rule grants whose allowance a correction replaces
    // under the `correction` policy.
    grantedBy: Provenance[];
  }[];
  removed: { id: string; correction: string; overrides: Provenance[] }[];
  corrections: {
    id: string;
    action: 'grant' | 'remove';
    capability: string;
    expiresAt: string;
    effect: 'applied' | 'undefined_capability';
  }[];
  sources: { source: string; asAt: string; records: string[] }[];
  oldestSourceAsAt: string | null;
  // Not errors, but staff need to see them: records no capability rule
  // matched, records no state rule classified, and fact-based allowances whose
  // fact was missing or not a whole number (resolved as unknown).
  diagnostics: {
    ungrantedRecords: RecordRef[];
    unclassifiedRecords: RecordRef[];
    missingFacts: (RecordProvenance & { fact: string })[];
  };
  hash: string;
};

export class ResolverInputError extends Error {
  // Issue paths and messages only. Input values may identify a member.
  constructor(readonly issues: string[]) {
    super(`Invalid resolver input: ${issues.join('; ')}`);
    this.name = 'ResolverInputError';
  }
}

export type AccessConflict =
  | { kind: 'corrections'; capability: string; corrections: string[] }
  | { kind: 'mixed_allowances'; capability: string; grantedBy: Provenance[] }
  | { kind: 'correction_with_rule_grant'; capability: string; grantedBy: Provenance[] };

// Valid input that the rule set's policies refuse to resolve. The caller keeps
// the member's last good access and shows staff the conflict.
export class AccessConflictError extends Error {
  constructor(readonly conflicts: AccessConflict[]) {
    super(`Access conflicts: ${conflicts.map((c) => `${c.kind}(${c.capability})`).join(', ')}`);
    this.name = 'AccessConflictError';
  }
}

export function resolveAccess(raw: ResolverInput): Resolution {
  const parsed = ResolverInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new ResolverInputError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`),
    );
  const input = parsed.data;
  const { rules } = input;
  const records = input.sources
    .flatMap((snapshot) =>
      snapshot.records.map((record) => ({ ...record, source: snapshot.source })),
    )
    .sort((a, b) => compare(a.source, b.source) || compare(a.ref, b.ref));
  const where = (record: (typeof records)[number]) => ({
    source: record.source,
    record: record.ref,
  });

  const grants = new Map<string, { allowance: ResolvedAllowance; provenance: Provenance }[]>();
  const contribute = (capability: string, allowance: ResolvedAllowance, provenance: Provenance) =>
    grants.set(capability, [...(grants.get(capability) ?? []), { allowance, provenance }]);
  let label: { text: string; priority: number; provenance: RecordProvenance[] } | undefined;
  const ungrantedRecords: RecordRef[] = [];
  const missingFacts: Resolution['diagnostics']['missingFacts'] = [];
  for (const record of records) {
    let granted = false;
    for (const rule of [...rules.rules].sort(byId)) {
      if (!matches(rule.match, record)) continue;
      const provenance = { rule: rule.id, ...where(record) };
      for (const grant of rule.grants) {
        granted = true;
        const allowance = allowanceFor(grant.allowance, record.facts);
        if (grant.allowance.kind === 'fact' && allowance.kind === 'unknown')
          missingFacts.push({ ...provenance, fact: grant.allowance.fact });
        contribute(grant.capability, allowance, { kind: 'rule', ...provenance });
      }
      if (!rule.label) continue;
      if (!label || rule.label.priority > label.priority) label = { ...rule.label, provenance: [] };
      if (rule.label.priority === label.priority) label.provenance.push(provenance);
    }
    if (!granted) ungrantedRecords.push(where(record));
  }

  let state: MemberState = 'none';
  const stateProvenance: RecordProvenance[] = [];
  const unclassifiedRecords: RecordRef[] = [];
  const rank = (candidate: MemberState) => rules.states.precedence.indexOf(candidate);
  for (const record of records) {
    const classified = [...rules.states.rules]
      .sort(byId)
      .filter((rule) => matches(rule.match, record));
    if (!classified.length) unclassifiedRecords.push(where(record));
    for (const rule of classified) {
      if (!stateProvenance.length || rank(rule.state) < rank(state)) {
        state = rule.state;
        stateProvenance.length = 0;
      }
      if (rule.state === state) stateProvenance.push({ rule: rule.id, ...where(record) });
    }
  }

  // Corrections apply after rules. Only this member's corrections recorded by
  // the evaluation time count, and an amendment hides the record it
  // supersedes. More than one active correction for a capability is a conflict
  // for staff to settle by amendment, not something to guess.
  const now = input.evaluatedAt;
  const conflicts: AccessConflict[] = [];
  const visible = input.corrections.filter(
    (correction) => correction.memberId === input.memberId && correction.recordedAt <= now,
  );
  const superseded = new Set(visible.map((correction) => correction.supersedes));
  const active = visible.filter(
    (correction) =>
      !superseded.has(correction.id) &&
      (correction.effectiveFrom ?? correction.recordedAt) <= now &&
      now < correction.expiresAt,
  );
  const catalogue = new Map(rules.capabilities.map((capability) => [capability.id, capability]));
  const removed: Resolution['removed'] = [];
  const replaced = new Set<string>();
  for (const capability of [...new Set(active.map((correction) => correction.capability))].sort(
    compare,
  )) {
    const corrections = active.filter((correction) => correction.capability === capability);
    if (!catalogue.has(capability)) continue;
    if (corrections.length > 1) {
      conflicts.push({
        kind: 'corrections',
        capability,
        corrections: corrections.map((c) => c.id).sort(compare),
      });
      continue;
    }
    const [correction] = corrections;
    const ruleGrants = grants.get(capability) ?? [];
    if (correction.action === 'remove') {
      removed.push({
        id: capability,
        correction: correction.id,
        overrides: ruleGrants.map((g) => g.provenance),
      });
      grants.delete(capability);
      continue;
    }
    const provenance: Provenance = {
      kind: 'correction',
      correction: correction.id,
      expiresAt: correction.expiresAt,
    };
    const policy = rules.policies.correctionWithRuleGrant;
    if (ruleGrants.length && policy === 'reject')
      conflicts.push({
        kind: 'correction_with_rule_grant',
        capability,
        grantedBy: [...ruleGrants.map((g) => g.provenance), provenance].sort(byProvenance),
      });
    if (ruleGrants.length && policy === 'correction') replaced.add(capability);
    contribute(capability, correction.allowance as ResolvedAllowance, provenance);
  }

  const capabilities: Resolution['capabilities'] = [];
  for (const [capability, contributions] of [...grants].sort(([a], [b]) => compare(a, b))) {
    const grantedBy = contributions.map((grant) => grant.provenance).sort(byProvenance);
    const allowances = contributions
      .filter((grant) => !replaced.has(capability) || grant.provenance.kind === 'correction')
      .map((grant) => grant.allowance);
    const mixed =
      allowances.some((allowance) => allowance.kind === 'unknown') &&
      allowances.some((allowance) => allowance.kind === 'limited');
    if (mixed && rules.policies.mixedAllowances === 'reject')
      conflicts.push({ kind: 'mixed_allowances', capability, grantedBy });
    const [only] = grantedBy;
    const { label: text, unit } = catalogue.get(capability)!;
    capabilities.push({
      id: capability,
      label: text,
      unit: unit ?? null,
      allowance: allowances.reduce(maxAllowance),
      until: grantedBy.length === 1 && only.kind === 'correction' ? only.expiresAt : null,
      grantedBy,
    });
  }
  if (conflicts.length) throw new AccessConflictError(conflicts);

  const sources = input.sources
    .map((snapshot) => ({
      source: snapshot.source,
      asAt: snapshot.asAt,
      records: snapshot.records.map((record) => record.ref).sort(compare),
    }))
    .sort((a, b) => compare(a.source, b.source));
  const resolution: Omit<Resolution, 'hash'> = {
    memberId: input.memberId,
    evaluatedAt: now,
    rulesVersion: rules.version,
    state,
    stateProvenance: stateProvenance.sort(byProvenance),
    planLabel: label?.text ?? null,
    labelProvenance: (label?.provenance ?? []).sort(byProvenance),
    capabilities,
    removed,
    corrections: active
      .map((correction) => ({
        id: correction.id,
        action: correction.action,
        capability: correction.capability,
        expiresAt: correction.expiresAt,
        effect: catalogue.has(correction.capability)
          ? ('applied' as const)
          : ('undefined_capability' as const),
      }))
      .sort(byId),
    sources,
    oldestSourceAsAt: sources.map((snapshot) => snapshot.asAt).sort(compare)[0] ?? null,
    diagnostics: { ungrantedRecords, unclassifiedRecords, missingFacts },
  };
  return { ...resolution, hash: hashCanonical(resolution) };
}

// The member-facing projection: no provenance, record references, correction
// reasons or source facts. Its hash covers only this projection, so it stays
// the same across re-evaluations that do not change what the member sees. The
// full resolution's hash also covers provenance and the evaluation time.
export function memberAccess(resolution: Resolution) {
  const access = {
    state: resolution.state,
    planLabel: resolution.planLabel,
    capabilities: resolution.capabilities.map(({ id, label, unit, allowance, until }) => ({
      id,
      label,
      unit,
      allowance,
      until,
    })),
    sourceAsAt: resolution.oldestSourceAsAt,
    rulesVersion: resolution.rulesVersion,
  };
  return { ...access, hash: hashCanonical(access) };
}

// Overlapping grants of one capability take the larger allowance rather than
// the sum. Unlimited exceeds every amount. Under the `unknown` mixed-allowance
// policy an unknown allowance stays unknown and keeps any known amount it
// overlaps as a lower bound.
export function maxAllowance(a: ResolvedAllowance, b: ResolvedAllowance): ResolvedAllowance {
  if (a.kind === 'unlimited' || b.kind === 'unlimited') return { kind: 'unlimited' };
  if (a.kind === 'limited' && b.kind === 'limited')
    return { kind: 'limited', amount: Math.max(a.amount, b.amount) };
  const known = [a, b].flatMap((allowance) =>
    allowance.kind === 'limited' ? [allowance.amount] : (allowance.atLeast ?? []),
  );
  return known.length ? { kind: 'unknown', atLeast: Math.max(...known) } : { kind: 'unknown' };
}

// Canonical JSON: object keys sorted, undefined members omitted. Arrays keep
// their order, so callers sort them before serialising.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, member]) => member !== undefined)
      .sort(([a], [b]) => compare(a, b))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export const hashCanonical = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

function matches(match: Match, record: { source: string; facts: Record<string, FactValue> }) {
  if (match.sources && !match.sources.includes(record.source)) return false;
  return Object.entries(match.facts).every(([fact, allowed]) => {
    const value = Object.hasOwn(record.facts, fact) ? record.facts[fact] : null;
    return value !== null && allowed.includes(value);
  });
}

function allowanceFor(
  allowance: z.infer<typeof GrantAllowanceSchema>,
  facts: Record<string, FactValue>,
): ResolvedAllowance {
  if (allowance.kind !== 'fact') return allowance;
  const amount = Object.hasOwn(facts, allowance.fact) ? facts[allowance.fact] : null;
  return typeof amount === 'number' && Number.isInteger(amount) && amount >= 0
    ? { kind: 'limited', amount }
    : { kind: 'unknown' };
}

// Code-unit order, independent of locale.
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a: { id: string }, b: { id: string }) => compare(a.id, b.id);
const byProvenance = (a: object, b: object) => compare(canonicalJson(a), canonicalJson(b));
function unique(values: unknown[]) {
  return new Set(values).size === values.length;
}
