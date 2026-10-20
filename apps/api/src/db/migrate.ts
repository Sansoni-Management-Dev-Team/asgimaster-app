import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config.js';

export async function migrateDatabase(pool: Pool) {
  const client = await pool.connect();
  try {
    // Session lock covers the migrator's own transaction and is released on crash.
    await client.query("set lock_timeout = '30s'");
    await client.query('select pg_advisory_lock($1)', [266109]);
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)),
    });
  } finally {
    try {
      await client.query('select pg_advisory_unlock($1)', [266109]);
    } finally {
      client.release();
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = new Pool(loadConfig().database);
  try {
    await migrateDatabase(pool);
    console.log('Database migrations complete.');
  } catch {
    console.error('Database migration failed. Review database configuration and migration SQL.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
