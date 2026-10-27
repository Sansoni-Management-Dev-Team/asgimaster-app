import { Hono } from 'hono';
import { html } from 'hono/html';
import { z } from 'zod';
import { enhanced, staffPage, tableRegion } from './admin-page.js';
import type { Services } from './services.js';
import type { SourceState } from './member-sources.js';
import { dateLabel } from './admin-invitations.js';
import { AppError } from './errors.js';

const sourceLabels: Record<SourceState['status'], string> = {
  not_configured: 'Not connected',
  not_connected: 'Connection pending',
  unavailable: 'Temporarily unavailable',
};
const sourceSummary = (sources: SourceState[]) =>
  html`<details class="source-details">
    <summary>Membership and identity sources</summary>
    <ul>
      ${sources.map((source) => html`<li>${source.name}: ${sourceLabels[source.status]}</li>`)}
    </ul>
    <p>
      External membership and identity records are not available here yet. Saved accounts remain
      available. No upstream links, subscriptions or access have been inferred.
    </p>
  </details>`;

const loginStatus = (login: { disabled: boolean; established: boolean } | null) =>
  !login
    ? 'No linked login'
    : login.disabled
      ? 'Login disabled'
      : login.established
        ? 'Login established'
        : 'Invitation not yet accepted';

export function memberDirectoryRoutes(services: () => Services) {
  // Mounted inside adminRoutes, after its staff cookie and OTP permission checks.
  const app = new Hono<{ Variables: { csrf: string } }>();
  app.get('/', async (c) => {
    const parsed = z
      .object({
        q: z.string().trim().max(254).default(''),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .safeParse({ q: c.req.query('q'), page: c.req.query('page') });
    if (!parsed.success)
      throw new AppError(
        400,
        'INVALID_SEARCH',
        'Use a search of up to 254 characters and a valid page.',
      );
    const { q, page: pageNumber } = parsed.data;
    const directory = services().memberDirectory;
    const [result, sources] = await Promise.all([
      directory.list(q, pageNumber),
      directory.sources(),
    ]);
    const pageLink = (number: number) =>
      '/admin/members?' + new URLSearchParams({ q, page: String(number) });
    const results = html`<section id="member-results" aria-label="Member search results">
      <p data-results-summary>
        ${result.rows.length} saved ${result.rows.length === 1 ? 'account' : 'accounts'} shown ·
        page ${pageNumber}${result.hasNext ? ' · more available' : ''}
      </p>
      ${
        result.rows.length
          ? tableRegion(
              'Saved member accounts',
              html`<table>
                <caption>
                  Saved member accounts · page ${pageNumber}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Login</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.rows.map(
                    ({ member, login }) =>
                      html`<tr>
                        <td>
                          <a
                            href="/admin/members/${encodeURIComponent(member.id)}?${new URLSearchParams({ q, page: String(pageNumber) })}"
                            >${member.displayName}</a
                          ><small>${member.email}</small>
                        </td>
                        <td>${loginStatus(login)}</td>
                      </tr>`,
                  )}
                </tbody>
              </table>`,
            )
          : html`<p>
              ${q ? 'No saved member accounts match your search.' : 'No member accounts have been saved yet.'}
              Try another search or <a href="/admin/members">clear the search</a>.
            </p>`
      }
      <nav aria-label="Member pages">
        ${pageNumber > 1 ? html`<a href="${pageLink(pageNumber - 1)}" hx-get="${pageLink(pageNumber - 1)}" hx-target="#member-results" hx-swap="outerHTML" hx-push-url="true">Previous page</a>` : ''}
        ${result.hasNext && pageNumber < 10000 ? html`<a href="${pageLink(pageNumber + 1)}" hx-get="${pageLink(pageNumber + 1)}" hx-target="#member-results" hx-swap="outerHTML" hx-push-url="true">Next page</a>` : ''}
      </nav>
    </section>`;
    if (enhanced(c) && c.req.header('HX-Target') === 'section#member-results') {
      return c.html(html`<title>Members · Sansoni</title>${results}`);
    }
    return c.html(
      staffPage(
        c,
        'Members',
        html` <p class="page-description">
            Browse saved member accounts. This list is not the authoritative Maxio membership
            roster; an account or accepted invitation does not establish membership access.
          </p>
          ${sourceSummary(sources)}
          <form
            class="search-toolbar"
            id="member-search-form"
            method="get"
            action="/admin/members"
            hx-get="/admin/members"
            hx-trigger="submit, input changed delay:350ms from:#member-search"
            hx-target="#member-results"
            hx-swap="outerHTML"
            hx-replace-url="true"
            hx-disable="find button"
          >
            <label for="member-search">Search members</label>
            <input
              id="member-search"
              name="q"
              value="${q}"
              maxlength="254"
              type="search"
              placeholder="Name, email or member reference"
            />
            <div class="actions">
              <button>
                <span class="ready">Search members</span><span class="pending">Searching…</span>
              </button>
              <a href="/admin/members">Clear search</a>
            </div>
          </form>
          ${results}`,
        c.get('csrf'),
      ),
    );
  });
  app.get('/:id', async (c) => {
    const result = await services().memberDirectory.get(c.req.param('id'));
    if (!result) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member account not found.');
    const { member, login, invitations, sources } = result;
    return c.html(
      staffPage(
        c,
        member.displayName,
        html`<p>
            <a
              href="/admin/members?${new URLSearchParams({ q: (c.req.query('q') ?? '').slice(0, 254), page: /^(?:[1-9]\d{0,3}|10000)$/.test(c.req.query('page') ?? '') ? c.req.query('page')! : '1' })}"
              >Back to member results</a
            >
          </p>
          <h2>Account</h2>
          <dl>
            <dt>Email</dt>
            <dd>${member.email}</dd>
            <dt>Member reference</dt>
            <dd>${member.id}</dd>
            <dt>Account created</dt>
            <dd>${dateLabel(member.createdAt)}</dd>
            <dt>Login</dt>
            <dd>${loginStatus(login)}</dd>
          </dl>
          <h2>Membership access</h2>
          <p>Access is being set up. No resolved capabilities are available.</p>
          ${sourceSummary(sources)}
          <h2>Invitations</h2>
          ${
            invitations.length
              ? tableRegion(
                  'Member invitations',
                  html`<table>
                    <caption>
                      Most recent invitations (up to 100)
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Created</th>
                        <th scope="col">Status</th>
                        <th scope="col">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invitations.map(
                        (invite) =>
                          html`<tr>
                            <td>${dateLabel(invite.createdAt)}</td>
                            <td>
                              ${invite.status === 'pending' && invite.expiresAt.getTime() <= Date.now() ? 'expired' : invite.status}
                            </td>
                            <td>${dateLabel(invite.expiresAt)}</td>
                          </tr>`,
                      )}
                    </tbody>
                  </table>`,
                )
              : html`<p>No invitations recorded.</p>`
          }
          <p><a href="/admin">Manage invitations and mail delivery</a></p>`,
        c.get('csrf'),
      ),
    );
  });
  return app;
}
