import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMaxioAdapter } from './adapter.js';
import {
  createMaxioReconciliation,
  type MaxioStore,
  type StoredMaxioCollection,
} from './reconciliation.js';
import type { MaxioResult } from './types.js';

async function fixture(region: 'AU' | 'NZ', count = 2): Promise<MaxioResult> {
  return createMaxioAdapter(
    region,
    { subdomain: `synthetic-${region.toLowerCase()}`, apiKey: 'synthetic' },
    {
      now: () => new Date('2026-01-01T00:00:00Z'),
      transport: async (url) =>
        Response.json(
          url.searchParams.get('page') === '1'
            ? Array.from({ length: count }, (_, i) => ({
                subscription: {
                  id: i + 1,
                  state: 'active',
                  updated_at: '2026-01-01T00:00:00Z',
                  product: { id: 1, handle: 'synthetic' },
                  customer: { id: i + 1, email: `synthetic-${i}@example.test` },
                },
              }))
            : [],
        ),
    },
  ).collect();
}
async function setup() {
  let saved: StoredMaxioCollection | null = null;
  let conflict = false,
    storageFailure = false,
    calls = 0;
  let time = new Date('2026-01-01T00:00:01Z');
  const results = { AU: await fixture('AU'), NZ: await fixture('NZ') };
  const store: MaxioStore = {
    read: async () => structuredClone(saved),
    compareAndSwap: async (expected, next) => {
      if (storageFailure) throw new Error('synthetic-storage-private');
      if (conflict || expected !== (saved?.revision ?? null)) return false;
      saved = structuredClone(next);
      return true;
    },
  };
  const coordinator = createMaxioReconciliation({
    sources: {
      AU: {
        collect: async () => {
          calls++;
          return results.AU;
        },
      },
      NZ: {
        collect: async () => {
          calls++;
          return results.NZ;
        },
      },
    },
    store,
    now: () => time,
    staleAfterMs: 1000,
    throttleMs: 500,
    // Synthetic test policy only; no production completeness floor is approved.
    acceptCompleteness: (candidate, previous) =>
      !previous || candidate.evidence.subscriptions >= previous.evidence.subscriptions,
  });
  return {
    coordinator,
    results,
    saved: () => saved,
    calls: () => calls,
    conflict: () => {
      conflict = true;
    },
    failStorage: () => {
      storageFailure = true;
    },
    tick: (ms: number) => {
      time = new Date(time.getTime() + ms);
    },
  };
}
test('nightly full pulls repair missed changes and are idempotent; refresh triggers single-flight', async () => {
  const s = await setup();
  const a = s.coordinator.nightly(),
    b = s.coordinator.staffRefresh();
  assert.equal(a, b);
  assert.equal((await a).status, 'ready');
  assert.equal(s.calls(), 2);
  const revision = s.saved()!.contentHash;
  assert.equal((await s.coordinator.nightly()).status, 'ready');
  assert.equal(s.saved()!.contentHash, revision);
  s.results.AU = await fixture('AU', 3);
  assert.equal((await s.coordinator.nightly()).status, 'ready');
  assert.equal(s.saved()!.snapshots.AU.members.length, 3);
  assert.notEqual(s.saved()!.contentHash, revision);
});
test('AU or NZ failing independently retains the entire last-good collection and success time', async () => {
  for (const region of ['AU', 'NZ'] as const) {
    for (const code of [
      'empty',
      'incomplete',
      'malformed',
      'unavailable',
      'not_configured',
    ] as const) {
      const s = await setup();
      await s.coordinator.nightly();
      const previous = structuredClone(s.saved());
      const lastSuccess = s.coordinator.health().lastSuccess;
      s.tick(2000);
      s.results[region] = { status: 'failed', region, code };
      const health = await s.coordinator.nightly();
      assert.equal(health.status, 'held');
      assert.deepEqual(health.failures, [{ source: region, code }]);
      assert.equal(health.lastSuccess, lastSuccess);
      assert.deepEqual(s.saved(), previous);
    }
  }
});
test('first empty collection, suspicious counts and changed sites cannot replace saved inputs', async () => {
  const empty = await setup();
  empty.results.AU = await fixture('AU', 0);
  assert.equal((await empty.coordinator.nightly()).status, 'held');
  assert.equal(empty.saved(), null);
  const s = await setup();
  await s.coordinator.nightly();
  const previous = structuredClone(s.saved());
  s.results.AU = await fixture('AU', 1);
  assert.equal((await s.coordinator.nightly()).status, 'held');
  assert.deepEqual(s.saved(), previous);
  s.results.AU = await fixture('AU');
  if (s.results.AU.status === 'complete') s.results.AU.snapshot.site = 'different-site';
  assert.equal((await s.coordinator.nightly()).status, 'held');
  assert.deepEqual(s.saved(), previous);
});
test('store conflict and write failure retain old inputs and surface only sanitized health', async () => {
  for (const failure of ['conflict', 'storage'] as const) {
    const s = await setup();
    await s.coordinator.nightly();
    const previous = structuredClone(s.saved());
    s.results.AU = await fixture('AU', 3);
    if (failure === 'conflict') s.conflict();
    else s.failStorage();
    const health = await s.coordinator.nightly();
    assert.equal(health.status, failure === 'conflict' ? 'held' : 'failed');
    assert.equal(JSON.stringify(health).includes('private'), false);
    assert.deepEqual(s.saved(), previous);
  }
});
test('stale-on-open is throttled, health reads cannot mutate internal state, stale data remains saved', async () => {
  const s = await setup();
  await s.coordinator.onOpen();
  assert.equal(s.calls(), 2);
  await s.coordinator.onOpen();
  assert.equal(s.calls(), 2);
  s.tick(2000);
  s.results.NZ = { status: 'failed', region: 'NZ', code: 'unavailable' };
  await s.coordinator.onOpen();
  assert.equal(s.calls(), 4);
  assert.ok(s.saved());
  const health = s.coordinator.health();
  health.failures.length = 0;
  assert.equal(s.coordinator.health().failures.length, 1);
  await s.coordinator.onOpen();
  assert.equal(s.calls(), 4);
});

test('simultaneous coordinators reject a stale publisher even with identical facts and different freshness', async () => {
  let saved: StoredMaxioCollection | null = null;
  const store: MaxioStore = {
    read: async () => structuredClone(saved),
    compareAndSwap: async (expected, next) => {
      if (expected !== (saved?.revision ?? null)) return false;
      saved = structuredClone(next);
      return true;
    },
  };
  const AU = await fixture('AU'),
    NZ = await fixture('NZ');
  assert.equal(AU.status, 'complete');
  assert.equal(NZ.status, 'complete');
  if (AU.status !== 'complete' || NZ.status !== 'complete') return;
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  function coordinator(asAt: string, slow: boolean) {
    const au = structuredClone(AU),
      nz = structuredClone(NZ);
    if (au.status === 'complete') au.snapshot.collectedAt = asAt;
    if (nz.status === 'complete') nz.snapshot.collectedAt = asAt;
    return createMaxioReconciliation({
      store,
      staleAfterMs: 1000,
      throttleMs: 1000,
      acceptCompleteness: () => true,
      sources: {
        AU: {
          collect: async () => {
            if (slow) {
              started();
              await gate;
            }
            return au;
          },
        },
        NZ: { collect: async () => nz },
      },
    });
  }
  await coordinator('2026-01-01T00:00:00Z', false).nightly();
  const initial = (await store.read())!;
  const stale = coordinator('2026-01-01T00:00:01Z', true).nightly();
  await entered;
  assert.equal((await coordinator('2026-01-01T00:00:02Z', false).nightly()).status, 'ready');
  const current = (await store.read())!;
  assert.equal(current.contentHash, initial.contentHash);
  assert.notEqual(current.revision, initial.revision);
  release();
  assert.deepEqual((await stale).failures, [{ source: 'collection', code: 'conflict' }]);
  assert.deepEqual(saved, current);
  assert.equal(current.snapshots.AU.collectedAt, '2026-01-01T00:00:02Z');
});

test('stale-on-open storage errors return sanitized operational health', async () => {
  const coordinator = createMaxioReconciliation({
    sources: {
      AU: {
        collect: async () => {
          throw new Error('unexpected');
        },
      },
      NZ: {
        collect: async () => {
          throw new Error('unexpected');
        },
      },
    },
    store: {
      read: async () => {
        throw new Error('synthetic-private-store-error');
      },
      compareAndSwap: async () => {
        throw new Error('unexpected');
      },
    },
    acceptCompleteness: () => true,
    staleAfterMs: 1000,
    throttleMs: 1000,
  });
  const health = await coordinator.onOpen();
  assert.equal(health.status, 'failed');
  assert.deepEqual(health.failures, [{ source: 'collection', code: 'unavailable' }]);
  assert.equal(JSON.stringify(health).includes('private'), false);
});

test('fresh externally refreshed store clears a prior local failure and updates reported freshness', async () => {
  const s = await setup();
  await s.coordinator.nightly();
  s.tick(2000);
  s.results.NZ = { status: 'failed', region: 'NZ', code: 'unavailable' };
  assert.equal((await s.coordinator.onOpen()).status, 'held');
  // A separate coordinator has successfully replaced the persisted collection.
  const externalAsAt = '2026-01-01T00:00:03Z';
  s.saved()!.snapshots.AU.collectedAt = externalAsAt;
  s.saved()!.snapshots.NZ.collectedAt = externalAsAt;
  s.tick(501);
  const health = await s.coordinator.onOpen();
  assert.equal(health.status, 'ready');
  assert.deepEqual(health.failures, []);
  assert.equal(health.lastSuccess, new Date(externalAsAt).toISOString());
  assert.equal(s.calls(), 4);
});
