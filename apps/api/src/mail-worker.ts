import {
  initErrorReporting,
  reportError,
  flushErrorReporting,
  installProcessErrorHandlers,
} from './observability.js';
import { loadConfig } from './config.js';
import { createServices } from './services.js';
import { startMailWorker } from './operations.js';

initErrorReporting();
installProcessErrorHandlers();

const services = createServices(loadConfig()),
  worker = startMailWorker(services, reportError);
process.once('SIGTERM', worker.stop);
process.once('SIGINT', worker.stop);
await worker.done;
await services.database.pool.end();

await flushErrorReporting();
