import assert from 'node:assert/strict';
import { test } from 'node:test';

import { app } from './app.js';

// ECS only keeps a task running while the load balancer sees 200 from /health.
test('health check answers 200 so the load balancer keeps the task in service', async () => {
  const res = await app.request('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});
