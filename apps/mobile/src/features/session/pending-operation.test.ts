import { expect, it } from '@jest/globals';
import { createPendingOperation } from './pending-operation';
it('retries failed writes but saves A → B → A as three distinct acknowledged operations', async () => {
  let counter = 0;
  const operation = createPendingOperation(() => `write-${++counter}`);
  const serverReplies = new Map<string, string>();
  let stored = '';
  const save = (value: string, fail = false) => {
    const key = operation.keyFor(value);
    if (fail) return key;
    // Model the server's idempotency replay behavior.
    if (!serverReplies.has(key)) {
      stored = value;
      serverReplies.set(key, value);
    }
    operation.acknowledge(key);
    return key;
  };
  const failed = save('A', true);
  expect(save('A')).toBe(failed);
  const second = save('B');
  const third = save('A');
  expect(new Set([failed, second, third]).size).toBe(3);
  expect(stored).toBe('A');
  expect(serverReplies.size).toBe(3);
});
