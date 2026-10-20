import { loadConfig } from './config.js';
import { createServices } from './services.js';
import { startMailWorker } from './operations.js';

const services = createServices(loadConfig()),
  worker = startMailWorker(services);
process.once('SIGTERM', worker.stop);
process.once('SIGINT', worker.stop);
await worker.done;
await services.database.pool.end();
