import { Hono } from 'hono';
import { html } from 'hono/html';
import { z } from 'zod';
import type { Services } from './services.js';
import { enhanced, staffPage, tableRegion, dialogActionLink } from './admin-page.js';
import { staffChange, staffRoleChange } from './staff-management.js';
import { AppError } from './errors.js';

type Values = Record<string, string | File>;
export const staffFormKey = (id: string) => (id ? `staff-${id}-edit` : 'staff-add');
export function staffForm(
  csrf: string,
  id = '',
  values: Values = {},
  message = '',
  errors: Record<string, string> = {},
) {
  const key = staffFormKey(id);
  const path = id ? `/admin/staff/${encodeURIComponent(id)}/edit` : '/admin/staff/new';
  const value = (name: string) => (typeof values[name] === 'string' ? values[name] : '');
  const field = (name: string, label: string, max: number, type = 'text') =>
    html`<label for="${key}-${name}">${label}</label
      ><input
        id="${key}-${name}"
        name="${name}"
        type="${type}"
        value="${value(name)}"
        required
        maxlength="${max}"
        aria-describedby="${key}-${name}-error"
        ${errors[name] ? html`aria-invalid="true"` : ''}
      /><small id="${key}-${name}-error" class="field-error">${errors[name] ?? ''}</small>`;
  return html`<div id="${key}" class="invitation-form">
    <h2 id="action-title" tabindex="-1">${id ? 'Change staff access' : 'Add staff'}</h2>
    <p>
      ${id ? value('subject') || id : 'Use an existing login or create a staff-only account. Existing names and membership are unchanged.'}
    </p>
    ${message ? html`<div class="error-summary" tabindex="-1" role="alert"><p>${message}</p></div>` : ''}
    <form
      method="post"
      action="${path}"
      hx-post="${path}"
      hx-target="#${key}"
      hx-swap="outerHTML settle:0"
      hx-sync="this:drop"
      hx-disable="find button"
    >
      <input type="hidden" name="csrf" value="${csrf}" />
      ${id ? html`<input type="hidden" name="expectedRole" value="${value('expectedRole')}" /><input type="hidden" name="subject" value="${value('subject')}" />` : html`${field('name', 'Name', 80)}${field('email', 'Email', 254, 'email')}`}
      <label for="${key}-role">${id ? 'New access' : 'Access'}</label>
      <select id="${key}-role" name="role">
        ${[['staff', 'Staff'], ['admin', 'Admin'], ...(id ? [['user', 'Remove staff access']] : [])].map(([role, label]) => html`<option value="${role}" ${value('role') === role ? html`selected` : ''}>${label}</option>`)}
      </select>
      <small
        >Staff manage members. Admins also manage this team. Removing staff access preserves
        membership.</small
      >
      ${field('reason', 'Reason', 500)}
      <div class="form-actions">
        <button><span class="ready">Save access</span><span class="pending">Saving…</span></button
        ><a href="/admin/staff" data-dialog-close>Cancel</a>
      </div>
    </form>
  </div>`;
}
export function staffManagementRoutes(services: () => Services) {
  const app = new Hono<{ Variables: { staffId: string; csrf: string; form: Values } }>();
  app.use('*', async (c, next) => {
    await services().staffManagement.requireAdmin(c.get('staffId'));
    await next();
  });
  app.get('/', async (c) => {
    const parsed = z
      .object({
        q: z.string().trim().max(254).default(''),
        role: z.enum(['', 'staff', 'admin']).default(''),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .safeParse(c.req.query());
    if (!parsed.success)
      throw new AppError(400, 'INVALID_SEARCH', 'Use a valid search, role and page.');
    const { q, role, page } = parsed.data;
    const result = await services().staffManagement.list(c.get('staffId'), q, role, page);
    const link = (page: number) =>
      '/admin/staff?' + new URLSearchParams({ q, role, page: String(page) });
    const results = html`<section id="staff-results" aria-label="Staff search results">
      <p data-results-summary>
        ${result.rows.length} staff accounts shown · page
        ${page}${result.hasNext ? ' · more available' : ''}
      </p>
      ${tableRegion(
        'Staff and admins',
        html`<table>
          <caption>
            Staff &amp; Admin
          </caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Access</th>
              <th scope="col">Member</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${result.rows.map(
              ({ person, memberId }) =>
                html`<tr>
                  <td>${person.name}<small>${person.email}</small></td>
                  <td>
                    <span class="badge">${person.role === 'admin' ? 'Admin' : 'Staff'}</span
                    >${person.banned ? html`<small>Account blocked</small>` : ''}${person.id === c.get('staffId') ? html`<small>You</small>` : ''}
                  </td>
                  <td>
                    ${memberId ? html`<a href="/admin/members/${encodeURIComponent(memberId)}">Member record</a>` : 'Staff only'}
                  </td>
                  <td>
                    <div class="row-actions">
                      ${dialogActionLink(`/admin/staff/${encodeURIComponent(person.id)}/edit`, 'Change access', '', `Change access for ${person.name}`)}${dialogActionLink(`/admin/staff/${encodeURIComponent(person.id)}/edit?remove=true`, 'Remove access', 'danger-link', `Remove staff access for ${person.name}`)}
                    </div>
                  </td>
                </tr>`,
            )}
            ${
              result.rows.length
                ? ''
                : html`<tr>
                    <td colspan="4">No staff accounts match this search.</td>
                  </tr>`
            }
          </tbody>
        </table>`,
      )}
      <nav aria-label="Staff pages">
        ${page > 1 ? html`<a href="${link(page - 1)}" hx-get="${link(page - 1)}" hx-target="#staff-results" hx-swap="outerHTML" hx-push-url="true">Previous page</a>` : ''}${result.hasNext && page < 10000 ? html`<a href="${link(page + 1)}" hx-get="${link(page + 1)}" hx-target="#staff-results" hx-swap="outerHTML" hx-push-url="true">Next page</a>` : ''}
      </nav>
    </section>`;
    if (enhanced(c) && c.req.header('HX-Target') === 'section#staff-results')
      return c.html(html`<title>Staff &amp; Admin · Sansoni</title>${results}`);
    return c.html(
      staffPage(
        c,
        'Staff & Admin',
        html` ${c.req.query('notice') === 'saved' ? html`<p class="notice" role="status">Staff access saved.</p>` : ''}
          <div class="page-toolbar">
            <p>Manage named staff access independently of membership.</p>
            ${dialogActionLink('/admin/staff/new', 'Add staff', 'primary-action')}
          </div>
          <form
            class="search-toolbar staff-search-toolbar"
            method="get"
            action="/admin/staff"
            hx-get="/admin/staff"
            hx-trigger="submit, input changed delay:350ms from:#staff-search, change from:#staff-role-filter"
            hx-target="#staff-results"
            hx-swap="outerHTML"
            hx-replace-url="true"
            hx-disable="find button"
          >
            <label for="staff-search">Search staff</label
            ><input id="staff-search" name="q" value="${q}" type="search" maxlength="254" />
            <label for="staff-role-filter">Access</label
            ><select id="staff-role-filter" name="role">
              <option value="">All roles</option>
              <option value="staff" ${role === 'staff' ? html`selected` : ''}>Staff</option>
              <option value="admin" ${role === 'admin' ? html`selected` : ''}>Admin</option>
            </select>
            <button><span class="ready">Search</span><span class="pending">Searching…</span></button
            ><a href="/admin/staff">Clear</a>
          </form>
          ${results}`,
        c.get('csrf'),
      ),
    );
  });
  for (const path of ['/new', '/:id/edit']) {
    app.get(path, async (c) => {
      const id = c.req.param('id') ?? '';
      const person = id ? await services().staffManagement.get(c.get('staffId'), id) : null;
      const values: Values = person
        ? {
            subject: `${person.name} · ${person.email}`,
            expectedRole: person.role!,
            role: c.req.query('remove') === 'true' ? 'user' : person.role!,
          }
        : { role: 'staff' };
      const view = staffForm(c.get('csrf'), id, values);
      if (enhanced(c) && c.req.header('HX-Target') === 'div#staff-dialog-content') {
        c.header('X-Staff-Dialog', 'true');
        return c.html(view);
      }
      return c.html(staffPage(c, id ? 'Change staff access' : 'Add staff', view, c.get('csrf')));
    });
    app.post(path, async (c) => {
      const id = c.req.param('id') ?? '';
      const values = c.get('form');
      const parsed = (id ? staffRoleChange : staffChange).safeParse(values);
      let message = parsed.success ? '' : 'Enter valid values for every field, including a reason.';
      let status: AppError['status'] = 400;
      if (parsed.success) {
        try {
          await services().staffManagement.change(c.get('staffId'), id || null, parsed.data);
        } catch (error) {
          status = error instanceof AppError ? error.status : 503;
          message =
            error instanceof AppError
              ? error.message
              : 'Unable to save access. Your entries are kept. Try again.';
        }
      }
      if (message) {
        const errors = parsed.success
          ? {}
          : Object.fromEntries(
              parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
            );
        const view = staffForm(c.get('csrf'), id, values, message, errors);
        if (enhanced(c) && c.req.header('HX-Target') === `div#${staffFormKey(id)}`) {
          c.header('X-Staff-Form', staffFormKey(id));
          return c.html(view, status);
        }
        return c.html(staffPage(c, 'Review staff access', view, c.get('csrf')), status);
      }
      // Demoting oneself must leave the privileged page immediately.
      const selfDemoted = id === c.get('staffId') && values.role !== 'admin';
      const destination = selfDemoted
        ? values.role === 'user'
          ? '/admin/sign-in'
          : '/admin'
        : '/admin/staff?notice=saved';
      if (enhanced(c)) {
        if (selfDemoted) {
          c.header('HX-Redirect', destination);
          return c.body(null, 200);
        }
        c.header(
          'HX-Location',
          JSON.stringify({ path: destination, target: '#staff-view', swap: 'outerHTML' }),
        );
        return c.body(null, 204);
      }
      return c.redirect(destination, 303);
    });
  }
  return app;
}
