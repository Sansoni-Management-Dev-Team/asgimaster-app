import type { Context } from 'hono';
import { html } from 'hono/html';

export const adminCsp =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
export const enhanced = (c: Context) =>
  c.req.header('HX-Request') === 'true' &&
  c.req.header('HX-Request-Type') === 'partial' &&
  c.req.header('HX-History-Restore-Request') !== 'true';

const document = (title: string, content: unknown) =>
  html`<!doctype html>
    <html lang="en" data-theme="light">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="htmx-config"
          content='{"includeIndicatorCSS":false,"mode":"same-origin","history":"reload","defaultTimeout":15000,"implicitInheritance":false}'
        />
        <title>${title} · Sansoni</title>
        <link rel="stylesheet" href="/staff-assets/pico.min.css" />
        <link rel="stylesheet" href="/staff-assets/admin.css" />
        <script src="/staff-assets/htmx-4.0.0.min.js" defer></script>
        <script src="/staff-assets/admin.js" defer></script>
      </head>
      <body>
        <a class="skip-link" href="#main">Skip to content</a>
        <p id="request-status" role="status" aria-live="polite" aria-atomic="true"></p>
        ${content}
        <dialog id="staff-dialog" aria-labelledby="action-title">
          <article>
            <p id="dialog-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <div id="staff-dialog-content"></div>
          </article>
        </dialog>
      </body>
    </html>`;

// Authentication is always a complete document and ordinary browser navigation.
export const page = (title: string, content: unknown) =>
  document(
    title,
    html`<header class="site-header">
        <a href="/admin/sign-in" class="brand">Sansoni <small>Staff workspace</small></a>
      </header>
      <main id="main" class="auth-page" tabindex="-1">
        <h1>${title}</h1>
        ${content}
      </main>`,
  );

export function staffPage(c: Context, title: string, content: unknown, csrf: string) {
  const members = c.req.path.startsWith('/admin/members');
  const view = html`<div
    id="staff-view"
    hx-history-elt
    hx-boost:inherited="true"
    hx-target:inherited="#staff-view"
    hx-swap:inherited="outerHTML"
    hx-sync:inherited="#staff-view:replace"
  >
    <header class="site-header">
      <a href="/admin" class="brand">Sansoni <small>Staff workspace</small></a>
      <nav aria-label="Staff navigation">
        <a href="/admin/members" aria-current="${members ? 'page' : 'false'}">Members</a>
        <a href="/admin" aria-current="${c.req.path === '/admin' ? 'page' : 'false'}"
          >Invitations</a
        >
        <a href="/admin/mail" aria-current="${c.req.path === '/admin/mail' ? 'page' : 'false'}"
          >Mail delivery</a
        >
      </nav>
      <form method="post" action="/admin/sign-out" hx-boost="false">
        <input type="hidden" name="csrf" value="${csrf}" /><button class="secondary">
          Sign out
        </button>
      </form>
    </header>
    <main id="main" tabindex="-1">
      <h1 tabindex="-1">${title}</h1>
      ${content}
    </main>
  </div>`;
  if (enhanced(c) && c.req.header('HX-Target') === 'div#staff-view') {
    c.header('X-Staff-View', 'true');
    return html`<title>${title} · Sansoni</title>${view}`;
  }
  return document(title, view);
}

export const tableRegion = (label: string, table: unknown) =>
  html`<div class="table-region" role="region" aria-label="${label}" tabindex="0">${table}</div>`;
