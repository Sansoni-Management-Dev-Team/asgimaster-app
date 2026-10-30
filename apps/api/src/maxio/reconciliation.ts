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
  // Source freshness: oldest collectedAt in the last successfully published collection.
  // This is never the coordinator's completion time or the time of a failed attempt.
  lastSuccess: string | null;
  status: 'not_connected' | 'refreshing' | 'ready' | 'held' | 'failed';
  failures: { source: 'AU' | 'NZ' | 'collection'; code: string }[];
};
export type CompletenessReview = (
  candidate: MaxioSnapshot,
  previous: MaxioSnapshot | null,
) => boolean;
function sourceFreshness(snapshots: MaxioCollection) {
  return Math.min(...[snapshots.AU, snapshots.NZ].map((source) => Date.parse(source.collectedAt)));
}
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
  let lastChecked = -Infinity;
  let observedRevision: string | null | undefined;
  let failedAttempt: { revision: string | null | undefined; at: number } | undefined;
  let health: ReconciliationHealth = {
    lastAttempt: null,
    lastSuccess: null,
    status: 'not_connected',
    failures: [],
  };
  async function run(): Promise<ReconciliationHealth> {
    const attempt = now().toISOString();
    lastChecked = now().getTime();
    let attemptedRevision = observedRevision;
    health = { ...health, lastAttempt: attempt, status: 'refreshing', failures: [] };
    try {
      const previous = await options.store.read();
      attemptedRevision = observedRevision = previous?.revision ?? null;
      if (previous)
        health.lastSuccess = new Date(sourceFreshness(previous.snapshots)).toISOString();
      // Serial calls keep concurrency below Maxio's per-site limits.
      const AU = await options.sources.AU.collect();
      const NZ = await options.sources.NZ.collect();
      const failures = [AU, NZ].flatMap((result) =>
        result.status === 'failed' ? [{ source: result.region, code: result.code }] : [],
      );
      if (AU.status !== 'complete' || NZ.status !== 'complete') {
        const unconfigured =
          AU.status === 'failed' &&
          AU.code === 'not_configured' &&
          NZ.status === 'failed' &&
          NZ.code === 'not_configured';
        health = { ...health, status: unconfigured ? 'not_connected' : 'held', failures };
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
      const revision = randomUUID();
      if (
        !(await options.store.compareAndSwap(previous?.revision ?? null, {
          revision,
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
        observedRevision = revision;
        failedAttempt = undefined;
        health = {
          lastAttempt: attempt,
          lastSuccess: new Date(sourceFreshness(snapshots)).toISOString(),
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
    } finally {
      if (health.status !== 'ready')
        failedAttempt = { revision: attemptedRevision, at: Date.parse(attempt) };
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
    if (now().getTime() - lastChecked < options.throttleMs) return structuredClone(health);
    lastChecked = now().getTime();
    try {
      const saved = await options.store.read();
      observedRevision = saved?.revision ?? null;
      const oldest = saved ? sourceFreshness(saved.snapshots) : -Infinity;
      if (now().getTime() - oldest < options.staleAfterMs) {
        // Fresh cached inputs do not erase a failed run. Recovery requires a new
        // publication token AND a whole collection fetched after that attempt.
        const recovered =
          saved &&
          failedAttempt?.revision !== undefined &&
          saved.revision !== failedAttempt.revision &&
          oldest > failedAttempt.at;
        if (!failedAttempt || recovered) {
          failedAttempt = undefined;
          health = {
            ...health,
            lastSuccess: new Date(oldest).toISOString(),
            status: 'ready',
            failures: [],
          };
        }
        return structuredClone(health);
      }
      return refresh();
    } catch {
      failedAttempt ??= { revision: observedRevision, at: now().getTime() };
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
