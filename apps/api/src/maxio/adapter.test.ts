import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMaxioAdapter, type MaxioOptions, type MaxioTransport } from './adapter.js';
import { loadMaxioSites } from './config.js';
import { projectMaxioForResolver } from './projection.js';
const syntheticConfig = { subdomain: 'synthetic-au', apiKey: 'synthetic-key' };
const fixedNow = () => new Date('2026-01-01T00:00:00Z');
function row(
  id: number,
  customerId = 1,
  product: { id: number; handle: string } | null = { id: 7, handle: 'synthetic-product' },
) {
  return {
    subscription: {
      id,
      state: 'active',
      updated_at: '2025-12-31T00:00:00Z',
      customer: { id: customerId, email: `synthetic-${customerId}@example.test` },
      product,
    },
  };
}
function adapter(transport: MaxioTransport, options: MaxioOptions = {}) {
  return createMaxioAdapter('AU', syntheticConfig, {
    transport,
    now: fixedNow,
    wait: async () => {},
    ...options,
  });
}
const json = (data: unknown) => Response.json(data);
test('all pages and full customer subscription sets, site-qualified references, read-only transport and resolver projection', async () => {
  const requests: URL[] = [];
  const source = adapter(
    async (url, init) => {
      requests.push(url);
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      assert.equal(
        init.headers.Authorization,
        `Basic ${Buffer.from('synthetic-key:X').toString('base64')}`,
      );
      assert.equal(url.origin, 'https://synthetic-au.chargify.com');
      assert.deepEqual([...url.searchParams.keys()], ['page', 'per_page', 'sort', 'direction']);
      return json(
        [[row(1), row(2, 2)], [row(3, 1, null)], []][Number(url.searchParams.get('page')) - 1],
      );
    },
    { pageSize: 2 },
  );
  const result = await source.collect();
  assert.equal(result.status, 'complete');
  if (result.status !== 'complete') return;
  assert.equal(requests.length, 3);
  assert.deepEqual(result.snapshot.evidence, {
    pages: 3,
    subscriptions: 3,
    terminalEmptyPage: true,
  });
  assert.equal(result.snapshot.members.length, 2);
  const member = result.snapshot.members[0];
  assert.equal(member.reference, 'maxio:AU:synthetic-au:customer:1');
  assert.equal(member.subscriptions.length, 2);
  assert.equal(member.subscriptions[1].productId, null);
  const projected = projectMaxioForResolver(
    result.snapshot,
    new Set([member.subscriptions[1].reference]),
  );
  assert.equal(projected.records.length, 1);
  assert.equal(JSON.stringify(projected).includes(member.email), false);
  assert.equal(JSON.stringify(projected).includes('customerId'), false);
  for (const unknown of [
    'unknown',
    'maxio:NZ:synthetic-nz:subscription:1',
    'maxio:AU:other-site:subscription:1',
  ]) {
    assert.deepEqual(projectMaxioForResolver(result.snapshot, new Set([unknown])).records, []);
  }

  assert.equal(projected.records[0].facts.productHandle, null);
  assert.equal(projected.records[0].facts.state, 'active');
  assert.equal(projectMaxioForResolver(result.snapshot, new Set()).records.length, 0);
  const nz = await createMaxioAdapter(
    'NZ',
    { ...syntheticConfig, subdomain: 'synthetic-nz' },
    {
      transport: async (url) => json(url.searchParams.get('page') === '1' ? [row(1)] : []),
    },
  ).collect();
  assert.equal(nz.status, 'complete');
  if (nz.status === 'complete') assert.notEqual(nz.snapshot.members[0].reference, member.reference);
});
test('missing secrets and invalid configuration never call upstream', async () => {
  let calls = 0;
  const transport: MaxioTransport = async () => {
    calls++;
    throw new Error('unexpected');
  };
  assert.deepEqual(await createMaxioAdapter('AU', loadMaxioSites({}).AU, { transport }).collect(), {
    status: 'failed',
    region: 'AU',
    code: 'not_configured',
  });
  for (const config of [
    { ...syntheticConfig, subdomain: 'https://bad.example' },
    { ...syntheticConfig, apiKey: 'key:bad' },
  ]) {
    assert.equal(
      (await createMaxioAdapter('AU', config, { transport }).collect()).status,
      'failed',
    );
  }
  assert.equal(calls, 0);
});
test('empty, malformed, partial and repeated pages cannot publish a snapshot', async () => {
  for (const [payload, code] of [
    [[], 'empty'],
    [[row(1), {}], 'malformed'],
    [{ errors: 'synthetic' }, 'malformed'],
    [[{ subscription: { ...row(1).subscription, updated_at: 'bad' } }], 'malformed'],
  ] as const) {
    assert.deepEqual(await adapter(async () => json(payload)).collect(), {
      status: 'failed',
      region: 'AU',
      code,
    });
  }
  assert.deepEqual(await adapter(async () => json([row(1)])).collect(), {
    status: 'failed',
    region: 'AU',
    code: 'incomplete',
  });
  assert.deepEqual(
    await adapter(async (url) => json([row(Number(url.searchParams.get('page')))]), {
      maxPages: 2,
    }).collect(),
    { status: 'failed', region: 'AU', code: 'incomplete' },
  );
  assert.deepEqual(
    await adapter(async (url) =>
      url.searchParams.get('page') === '1' ? json([row(1)]) : new Response('', { status: 503 }),
    ).collect(),
    { status: 'failed', region: 'AU', code: 'unavailable' },
  );
});
test('429 retry-after, transient 5xx and network retries are bounded and scrubbed', async () => {
  const waits: number[] = [];
  let calls = 0;
  const source = adapter(
    async () => {
      calls++;
      if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '2' } });
      if (calls === 2) return new Response('', { status: 503 });
      return json(calls === 3 ? [row(1)] : []);
    },
    {
      wait: async (ms) => {
        waits.push(ms);
      },
    },
  );
  assert.equal((await source.collect()).status, 'complete');
  assert.deepEqual(waits, [2000, 1000]);
  calls = 0;
  const failed = await adapter(async () => {
    calls++;
    throw new Error('synthetic-private-body-and-key');
  }).collect();
  assert.equal(calls, 3);
  assert.equal(JSON.stringify(failed).includes('private'), false);
  for (const retryAfter of ['99999', 'invalid', 'Thu, 01 Jan 2026 00:10:00 GMT']) {
    assert.deepEqual(
      await adapter(
        async () => new Response('', { status: 429, headers: { 'retry-after': retryAfter } }),
      ).collect(),
      { status: 'failed', region: 'AU', code: 'rate_limited' },
    );
  }
  calls = 0;
  assert.equal(
    (
      await adapter(async () => {
        calls++;
        return new Response('', { status: 401 });
      }).collect()
    ).status,
    'failed',
  );
  assert.equal(calls, 1);
});
test('timeouts bound hung transports and body reads; malformed JSON is held', async () => {
  for (const transport of [
    async () => new Promise<Response>(() => {}),
    async () => new Response(new ReadableStream({ start() {} })),
  ]) {
    const result = await adapter(transport, { timeoutMs: 5, retries: 0 }).collect();
    assert.equal(result.status, 'failed');
  }
  assert.deepEqual(await adapter(async () => new Response('invalid-json')).collect(), {
    status: 'failed',
    region: 'AU',
    code: 'malformed',
  });
});
