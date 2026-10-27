import { html } from 'hono/html';
import { tableRegion } from './admin-page.js';
import type { invites, members, outbox } from './db/schema.js';

export const dateLabel = (date: Date) =>
  html`<time datetime="${date.toISOString()}" title="${date.toISOString()}"
    >${new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'Australia/Sydney' }).format(date)}</time
  >`;

export const invitationActionLink = (
  path: string,
  label: string,
  className = '',
  accessibleLabel = label,
) =>
  html`<a
    href="${path}"
    class="${className}"
    aria-label="${accessibleLabel}"
    data-dialog-open
    hx-get="${path}"
    hx-target="#staff-dialog-content"
    hx-swap="innerHTML"
    hx-sync="#staff-dialog:replace"
    hx-push-url="false"
    >${label}</a
  >`;

export type FormValues = Record<string, string | File>;
export type FormErrors = Record<string, string>;
// Form replacements skip attribute-settle transitions: refocusing an input
// before attributes settle can otherwise leave its displayed value empty.
export function invitationForm(
  csrf: string,
  action = 'create',
  id = '',
  values: FormValues = {},
  message = '',
  errors: FormErrors = {},
  subject = id,
) {
  const key = action === 'create' ? 'invite-create' : `invite-${id}-${action}`;
  const path =
    action === 'create' ? '/admin/invites' : `/admin/invites/${encodeURIComponent(id)}/${action}`;
  const field = (name: string, label: string, max: number, type = 'text') =>
    html`<label for="${key}-${name}">${label}</label>
      <input
        id="${key}-${name}"
        name="${name}"
        type="${type}"
        value="${typeof values[name] === 'string' ? values[name] : ''}"
        required
        maxlength="${max}"
        ${errors[name] ? html`aria-invalid="true"` : ''}
        aria-describedby="${key}-${name}-error"
      />
      <small id="${key}-${name}-error" class="field-error">${errors[name] ?? ''}</small>`;
  const title =
    action === 'create'
      ? 'Invite a member'
      : action === 'resend'
        ? 'Resend invitation'
        : 'Revoke invitation';
  return html`<div id="${key}" class="invitation-form">
    <h2 id="action-title" tabindex="-1">${title}</h2>
    <p>
      ${action === 'create' ? 'Create a saved account and queue an invitation. This does not verify membership or grant access.' : subject}
    </p>
    ${action === 'revoke' ? html`<p>Outstanding invitation credentials will stop working. An accepted account is not removed.</p>` : action === 'resend' ? html`<p>Replacement credentials will be queued. Previous invitation credentials will stop working.</p>` : ''}
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
      ${action === 'create' ? html`${field('displayName', 'Name', 80)}${field('email', 'Email', 254, 'email')}` : ''}
      ${field('reason', 'Reason', 500)}
      <div class="form-actions">
        <button class="${action === 'revoke' ? 'danger' : action === 'resend' ? 'secondary' : ''}">
          <span class="ready"
            >${action === 'create' ? 'Invite member' : action === 'resend' ? 'Resend' : 'Revoke'}</span
          ><span class="pending">Saving…</span></button
        ><a href="/admin" class="secondary" data-dialog-close>Cancel</a>
      </div>
    </form>
  </div>`;
}

export function invitationsView(
  rows: { invite: typeof invites.$inferSelect; member: typeof members.$inferSelect }[],
  notice: string,
) {
  return html`${notice ? html`<p class="notice" role="status">${notice}</p>` : ''}
    <div class="page-toolbar">
      <p>Manage invitations to saved member accounts.</p>
      ${invitationActionLink('/admin/invites/new', 'Invite member', 'primary-action')}
    </div>
    ${tableRegion(
      'Member invitations',
      html`<table>
        <caption>
          Most recent invitations (up to 100)
        </caption>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Status</th>
            <th scope="col" class="action-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            ({ invite, member }) =>
              html`<tr>
                <td>
                  <a href="/admin/members/${encodeURIComponent(member.id)}">${member.displayName}</a
                  ><small>${member.email}</small>
                </td>
                <td>
                  ${html`<span class="badge">${invite.status === 'pending' && invite.expiresAt.getTime() <= Date.now() ? 'expired' : invite.status}</span>`}<small
                    >${dateLabel(invite.expiresAt)}</small
                  >
                </td>
                <td>
                  ${
                    invite.status === 'pending'
                      ? html`<div class="row-actions">
                          ${invitationActionLink(`/admin/invites/${encodeURIComponent(invite.id)}/resend`, 'Resend', '', `Resend invitation for ${member.displayName}`)}
                          ${invitationActionLink(`/admin/invites/${encodeURIComponent(invite.id)}/revoke`, 'Revoke', 'danger-link', `Revoke invitation for ${member.displayName}`)}
                        </div>`
                      : html`<span class="muted">—</span>`
                  }
                </td>
              </tr>`,
          )}
          ${
            rows.length
              ? ''
              : html`<tr>
                  <td colspan="3">No invitations recorded.</td>
                </tr>`
          }
        </tbody>
      </table>`,
    )} `;
}

export function mailDeliveryView(
  messages: Pick<
    typeof outbox.$inferSelect,
    'id' | 'inviteId' | 'kind' | 'status' | 'attempts' | 'lastError' | 'createdAt'
  >[],
) {
  return html` <p>
      Pending messages retry automatically. Sent means the email service accepted the message; it
      does not confirm inbox delivery. Ask the member to request a new code if it expires.
    </p>
    ${tableRegion(
      'Mail delivery attempts',
      html`<table>
        <caption>
          Most recent mail attempts (up to 100)
        </caption>
        <thead>
          <tr>
            <th scope="col">Message</th>
            <th scope="col">Status</th>
            <th scope="col">Attempts</th>
            <th scope="col">Failure</th>
          </tr>
        </thead>
        <tbody>
          ${messages.map(
            (m) =>
              html`<tr>
                <td>
                  ${m.kind}<small>${m.id}</small
                  ><small>Invite: ${m.inviteId ?? 'Returning or staff sign-in'}</small>
                </td>
                <td>${m.status}</td>
                <td>${m.attempts}</td>
                <td>
                  ${m.lastError ? 'Delivery failed. Review the member’s invitation or request a fresh code.' : 'None recorded'}
                </td>
              </tr>`,
          )}
          ${
            messages.length
              ? ''
              : html`<tr>
                  <td colspan="4">No mail attempts recorded.</td>
                </tr>`
          }
        </tbody>
      </table>`,
    )}`;
}
