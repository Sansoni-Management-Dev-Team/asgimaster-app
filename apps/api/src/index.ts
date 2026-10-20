import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServices } from './services.js';
import { startMailWorker } from './operations.js';

const services = createServices(loadConfig());
const app = createApp({ services, peerAddress: (c) => getConnInfo(c).remote.address });
const worker = startMailWorker(services);
const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, (info) =>
  console.log(`API listening on port ${info.port}`),
);
async function shutdown() {
  worker.stop();
  server.close();
  await worker.done;
  await services.database.pool.end();
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
