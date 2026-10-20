import { realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

export const defaultWebRoot = fileURLToPath(new URL('../public/app/', import.meta.url));

// Expo's static export keeps assets at its root and emits route.html files.
// Restrict the mount to /app; API/admin paths never use an HTML fallback.
export function memberWebRoutes(root = defaultWebRoot) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      c.header('Allow', 'GET, HEAD');
      return c.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or HEAD.' } }, 405);
    }
    await next();
  });
  app.get('/', (c) => {
    const url = new URL(c.req.url);
    c.header('Cache-Control', 'no-store');
    return c.redirect(`/app/${url.search}`, 308);
  });
  app.on(['GET', 'HEAD'], '/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    let pathname: string;
    try {
      pathname = decodeURIComponent(c.req.path.slice('/app/'.length));
    } catch {
      return c.json({ error: { code: 'INVALID_PATH', message: 'Invalid resource path.' } }, 400);
    }
    const parts = pathname.split('/');
    if (
      pathname.includes('\\') ||
      pathname.includes('\0') ||
      parts.some((part, index) => part.startsWith('.') || (!part && index < parts.length - 1))
    )
      return c.json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } }, 404);
    let canonicalRoot: string;
    try {
      canonicalRoot = await realpath(root);
    } catch {
      return c.json(
        { error: { code: 'WEB_UNAVAILABLE', message: 'The member website is unavailable.' } },
        503,
      );
    }
    const clean = pathname.replace(/\/$/, '');
    const candidates = !clean
      ? ['index.html']
      : extname(clean)
        ? [clean]
        : [clean, `${clean}.html`, join(clean, 'index.html')];
    for (const candidate of candidates) {
      const path = resolve(canonicalRoot, candidate);
      if (!path.startsWith(canonicalRoot + sep)) continue;
      try {
        const actual = await realpath(path);
        if (actual !== path || !(await stat(actual)).isFile()) continue;
      } catch {
        continue;
      }
      const hashed = /(?:^|[-./])[a-f\d]{8,}(?=[.\/]|$)/i.test(candidate);
      c.header(
        'Cache-Control',
        candidate.endsWith('.html')
          ? 'no-store'
          : hashed
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
      );
      return serveStatic({ root: canonicalRoot, path: candidate })(c, next);
    }
    return c.json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } }, 404);
  });
  return app;
}
