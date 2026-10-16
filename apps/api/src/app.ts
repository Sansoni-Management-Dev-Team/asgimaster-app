import { Hono } from 'hono';

export const app = new Hono();

// The load balancer target group checks / and the container health check uses /health.
// Keep both free of database calls so a slow or restarting database does not cause
// ECS to replace healthy containers.
app.get('/', (c) => c.json({ status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));
