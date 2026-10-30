import { createHash, randomUUID } from 'node:crypto';
import type { MaxioCollection, MaxioResult, MaxioSnapshot } from './types.js';

export type StoredMaxioCollection = {
  revision: string;
  contentHash: string;
  snapshots: MaxioCollection;
};
export type MaxioStore = {
  read: () => Promise<StoredMaxioCollection | null>;
  // Durable implementations MUST atomically compare revision and replace BOTH sources.
  // A false return is a conflict; an exception must leave the old value intact.
  compareAndSwap: (
    expectedRevision: string | null,
    next: StoredMaxioCollection,
  ) => Promise<boolean>;
};
export type ReconciliationHealth = {
  lastAttempt: string | null;
  lastSuccess: string | null;
  status: 'not_connected' | 'refreshing' | 'ready' | 'held' | 'failed';
  failures: { source: 'AU' | 'NZ' | 'collection'; code: string }[];
};
export type CompletenessReview = (
  candidate: MaxioSnapshot,
  previous: MaxioSnapshot | null,
) => boolean;
// No default production completeness floor: D-37 requires approval. The injected
// reviewer must check source/member/subscription counts against approved policy.
export function createMaxioReconciliation(options: {
  sources: {
    AU: { collect: () => Promise<MaxioResult> };
    NZ: { collect: () => Promise<MaxioResult> };
  };
  store: MaxioStore;
  acceptCompleteness: CompletenessReview;
  now?: () => Date;
  staleAfterMs: number;
  throttleMs: number;
}) {
  if (
    ![options.staleAfterMs, options.throttleMs].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error('Invalid refresh intervals');
  const now = options.now ?? (() => new Date());
  let inFlight: Promise<ReconciliationHealth> | undefined;
  let lastStarted = -Infinity;
  let health: ReconciliationHealth = {
    lastAttempt: null,
    lastSuccess: null,
    status: 'not_connected',
    failures: [],
  };
  async function run(): Promise<ReconciliationHealth> {
    const attempt = now().toISOString();
    lastStarted = now().getTime();
    health = { ...health, lastAttempt: attempt, status: 'refreshing', failures: [] };
    try {
      const previous = await options.store.read();
      // Serial calls keep concurrency below Maxio's per-site limits.
      const AU = await options.sources.AU.collect();
      const NZ = await options.sources.NZ.collect();
      const failures = [AU, NZ].flatMap((result) =>
        result.status === 'failed' ? [{ source: result.region, code: result.code }] : [],
      );
      if (AU.status !== 'complete' || NZ.status !== 'complete') {
        health = { ...health, status: 'held', failures };
        return structuredClone(health);
      }
      const snapshots: MaxioCollection = { AU: AU.snapshot, NZ: NZ.snapshot };
      for (const region of ['AU', 'NZ'] as const) {
        const candidate = snapshots[region];
        if (
          candidate.region !== region ||
          !candidate.evidence.terminalEmptyPage ||
          !candidate.members.length ||
          (previous && previous.snapshots[region].site !== candidate.site) ||
          !options.acceptCompleteness(candidate, previous?.snapshots[region] ?? null)
        ) {
          health = {
            ...health,
            status: 'held',
            failures: [{ source: region, code: 'completeness' }],
          };
          return structuredClone(health);
        }
      }
      // Stable fact hash permits idempotent consumers; a fresh CAS token prevents
      // concurrent runs with identical facts from overwriting newer freshness.
      const contentHash = createHash('sha256')
        .update(
          JSON.stringify(
            [snapshots.AU, snapshots.NZ].map(({ collectedAt: _time, ...facts }) => facts),
          ),
        )
        .digest('hex');
      if (
        !(await options.store.compareAndSwap(previous?.revision ?? null, {
          revision: randomUUID(),
          contentHash,
          snapshots,
        }))
      ) {
        health = {
          ...health,
          status: 'held',
          failures: [{ source: 'collection', code: 'conflict' }],
        };
      } else {
        health = {
          lastAttempt: attempt,
          lastSuccess: now().toISOString(),
          status: 'ready',
          failures: [],
        };
      }
    } catch {
      health = {
        ...health,
        status: 'failed',
        failures: [{ source: 'collection', code: 'unavailable' }],
      };
    }
    return structuredClone(health);
  }
  function refresh() {
    if (!inFlight)
      inFlight = run().finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }
  async function onOpen() {
    if (inFlight) return inFlight;
    if (now().getTime() - lastStarted < options.throttleMs) return structuredClone(health);
    try {
      const saved = await options.store.read();
      const oldest = saved
        ? Math.min(
            ...[saved.snapshots.AU, saved.snapshots.NZ].map((source) =>
              Date.parse(source.collectedAt),
            ),
          )
        : -Infinity;
      if (now().getTime() - oldest < options.staleAfterMs) {
        health = {
          ...health,
          lastSuccess: new Date(oldest).toISOString(),
          status: 'ready',
          failures: [],
        };
        return structuredClone(health);
      }
      return refresh();
    } catch {
      health = {
        ...health,
        status: 'failed',
        failures: [{ source: 'collection', code: 'unavailable' }],
      };
      return structuredClone(health);
    }
  }
  // Invocation seams only: deployment must wire a durable scheduler and operator alerts.
  return { nightly: refresh, staffRefresh: refresh, onOpen, health: () => structuredClone(health) };
}
