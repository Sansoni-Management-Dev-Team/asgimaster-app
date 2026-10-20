import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDatabase>;
export function createDatabase(config: PoolConfig) {
  const pool = new Pool({ max: 10, connectionTimeoutMillis: 5000, ...config });
  const root = drizzle(pool, { schema });
  const context = new AsyncLocalStorage<NodePgDatabase<typeof schema>>();
  // Hooks, application writes and the auth adapter share the same transaction.
  const db = new Proxy(root, {
    get(_target, key) {
      const current = context.getStore() ?? root;
      const value = Reflect.get(current, key);
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
  const transaction = async <T>(work: () => Promise<T>): Promise<T> => {
    if (context.getStore()) return work();
    return root.transaction((tx) => context.run(tx as unknown as typeof root, work));
  };
  return { pool, db, transaction };
}
