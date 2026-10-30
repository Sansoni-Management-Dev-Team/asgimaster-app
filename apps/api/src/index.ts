import {
  initErrorReporting,
  reportError,
  flushErrorReporting,
  installProcessErrorHandlers,
} from './observability.js';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServices } from './services.js';
import { startMailWorker } from './operations.js';

initErrorReporting();
installProcessErrorHandlers();

const services = createServices(loadConfig());
const app = createApp({ services, reportError, peerAddress: (c) => getConnInfo(c).remote.address });
const worker = startMailWorker(services, reportError);
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '0.0.0.0';
const server = serve({ fetch: app.fetch, port, hostname }, (info) =>
  console.log(`API listening on port ${info.port}`),
);
async function shutdown() {
  worker.stop();
  server.close();
  await worker.done;
  await services.database.pool.end();
  await flushErrorReporting();
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
