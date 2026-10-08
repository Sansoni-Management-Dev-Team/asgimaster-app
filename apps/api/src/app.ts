import { Hono } from 'hono';

export const app = new Hono();

// The load balancer target group polls this path. Keep it free of database calls so a
// slow or restarting database does not cause ECS to replace healthy containers.
app.get('/health', (c) => c.json({ status: 'ok' }));
