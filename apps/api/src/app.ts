import { BlockList, isIP } from 'node:net';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { APIError } from 'better-auth/api';
import { loadConfig } from './config.js';
import { createServices, type Services } from './services.js';
import { memberRoutes } from './member.js';
import { adminRoutes } from './admin.js';
import { AppError } from './errors.js';

function trustedPeer(address: string, cidrs: string[]) {
  return cidrs.some((cidr) => {
    const [network, prefix] = cidr.split('/');
    if (!isIP(network)) return false;
    const list = new BlockList(),
      family = isIP(network) === 6 ? 'ipv6' : 'ipv4';
    if (prefix) list.addSubnet(network, Number(prefix), family);
    else list.addAddress(network, family);
    return list.check(address, address.includes(':') ? 'ipv6' : 'ipv4');
  });
}
export function createApp(
  options: { services?: Services; peerAddress?: (c: Context) => string | undefined } = {},
) {
  const app = new Hono();
  let instance = options.services;
  const services = () => (instance ??= createServices(loadConfig()));
  app.use('*', secureHeaders());
  app.use(
    '*',
    bodyLimit({
      maxSize: 16384,
      onError: (c) =>
        c.json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large.' } }, 413),
    }),
  );
  // Probes must never initialize auth/database configuration or open connections.
  app.get('/', (c) => c.json({ status: 'ok' }));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/sign-in', (c) =>
    c.html(
      '<!doctype html><html lang="en"><head><meta name="referrer" content="no-referrer"><title>Sign in to Sansoni</title></head><body><h1>Sign in to Sansoni</h1><p>Open the Sansoni app and request an email code to sign in. If you need the app or your invitation has expired, contact your membership support team.</p></body></html>',
    ),
  );
  app.all('/v1/auth/*', async (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    const { config, auth } = services();
    const headers = new Headers(c.req.raw.headers);
    const peer = options.peerAddress?.(c) ?? '127.0.0.1';
    const chain = headers.get('x-forwarded-for');
    // ALB appends the actual client. Only trust forwarding from configured proxy
    // peers; strip caller-controlled host/proto and alternative IP headers.
    headers.set(
      'x-sansoni-client-ip',
      chain && trustedPeer(peer, config.trustedProxyCidrs) ? `${chain}, ${peer}` : peer,
    );
    for (const name of [
      'x-forwarded-for',
      'x-real-ip',
      'x-forwarded-host',
      'x-forwarded-proto',
      'forwarded',
    ])
      headers.delete(name);
    const authResponse = await auth.handler(new Request(c.req.raw, { headers }));
    // Returning a native Response bypasses Hono's prepared response headers.
    // Apply privacy headers directly to every auth response, including exchanges.
    const authHeaders = new Headers(authResponse.headers);
    authHeaders.set('Cache-Control', 'no-store');
    authHeaders.set('Referrer-Policy', 'no-referrer');
    const response = new Response(authResponse.body, {
      status: authResponse.status,
      headers: authHeaders,
    });
    const location = response.headers.get('location');
    if (location && new URL(location, config.url).searchParams.has('error'))
      return c.json(
        {
          error: {
            code: 'SIGN_IN_FAILED',
            message: 'This sign-in credential is invalid or expired. Request a new one.',
          },
        },
        401,
      );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      const resultHeaders = new Headers(response.headers);
      resultHeaders.delete('content-length');
      resultHeaders.set('content-type', 'application/json');
      return new Response(
        JSON.stringify({
          error: {
            code: body.code ?? 'AUTH_FAILED',
            message: body.message ?? 'Unable to complete sign-in.',
          },
        }),
        { status: response.status, headers: resultHeaders },
      );
    }
    return response;
  });
  app.route('/v1/me', memberRoutes(services));
  app.route('/admin', adminRoutes(services));
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }, 404));
  app.onError((error, c) => {
    c.header('Cache-Control', 'no-store');
    if (error instanceof AppError)
      return c.json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof APIError && error.statusCode < 500)
      return c.json(
        {
          error: {
            code: error.body?.code ?? 'AUTH_FAILED',
            message: error.body?.message ?? 'Unable to sign in.',
          },
        },
        error.statusCode as 400,
      );
    // Neither request URLs nor raw exceptions are logged: both can contain credentials.
    console.error('API request failed.');
    return c.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable. Please try again.' } },
      503,
    );
  });
  return app;
}
export const app = createApp();
