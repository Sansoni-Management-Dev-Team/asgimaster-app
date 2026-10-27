import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Hono } from 'hono';

// Explicit public allowlist: no wildcard files, auth, database or vendor initialization.
export function adminAssets() {
  const app = new Hono();
  const assets = [
    [
      '/admin.css',
      new URL('../public/staff/admin.css', import.meta.url),
      'text/css; charset=utf-8',
    ],
    [
      '/admin.js',
      new URL('../public/staff/admin.js', import.meta.url),
      'text/javascript; charset=utf-8',
    ],
    [
      '/htmx-4.0.0.min.js',
      createRequire(import.meta.url).resolve('htmx.org/dist/htmx.min.js'),
      'text/javascript; charset=utf-8',
    ],
  ] as const;
  for (const [path, file, type] of assets) {
    app.on(['GET', 'HEAD'], path, async (c) => {
      const body = await readFile(file, 'utf8');
      c.header('Content-Type', type);
      c.header(
        'Cache-Control',
        path.startsWith('/htmx-') ? 'public, max-age=31536000, immutable' : 'public, no-cache',
      );
      return c.req.method === 'HEAD' ? c.body(null) : c.body(body);
    });
  }
  return app;
}
