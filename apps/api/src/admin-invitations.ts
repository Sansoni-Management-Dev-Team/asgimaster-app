import { html } from 'hono/html';
import { tableRegion } from './admin-page.js';
import type { invites, members, outbox } from './db/schema.js';

export type FormValues = Record<string, string | File>;
export type FormErrors = Record<string, string>;
export function invitationForm(
  csrf: string,
  action = 'create',
  id = '',
  values: FormValues = {},
  message = '',
  errors: FormErrors = {},
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
        aria-invalid="${errors[name] ? 'true' : 'false'}"
        aria-describedby="${key}-${name}-error"
      />
      <small id="${key}-${name}-error" class="field-error">${errors[name] ?? ''}</small>`;
  return html`<div
    id="${key}"
    role="group"
    aria-label="${action === 'create' ? 'Invite a member' : action === 'resend' ? 'Resend invitation' : 'Revoke invitation'}"
  >
    ${message ? html`<div class="error-summary" tabindex="-1" role="alert"><p>${message}</p></div>` : ''}
    <form
      method="post"
      action="${path}"
      hx-post="${path}"
      hx-target="#${key}"
      hx-swap="outerHTML"
      hx-sync="this:drop"
      hx-disable="find button"
    >
      <input type="hidden" name="csrf" value="${csrf}" />
      ${action === 'create' ? html`${field('displayName', 'Name', 80)}${field('email', 'Email', 254, 'email')}` : ''}
      ${field('reason', 'Reason', 500)}
      <button class="${action === 'revoke' ? 'danger' : action === 'resend' ? 'secondary' : ''}">
        <span class="ready"
          >${action === 'create' ? 'Invite member' : action === 'resend' ? 'Resend' : 'Revoke'}</span
        ><span class="pending">Saving…</span>
      </button>
    </form>
  </div>`;
}

export function invitationsView(
  csrf: string,
  rows: { invite: typeof invites.$inferSelect; member: typeof members.$inferSelect }[],
  messages: Pick<
    typeof outbox.$inferSelect,
    'id' | 'inviteId' | 'kind' | 'status' | 'attempts' | 'lastError' | 'createdAt'
  >[],
  notice: string,
) {
  return html`${notice ? html`<p class="notice" role="status">${notice}</p>` : ''}
    <p>
      Invite eligible members, resend pending invitations, or revoke invitations that have not been
      accepted.
    </p>
    <h2>Invite a member</h2>
    <p>
      This creates an explicitly provisioned account. It does not verify Maxio membership or grant
      access.
    </p>
    ${invitationForm(csrf)}
    <h2>Invitations</h2>
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
            <th scope="col">Actions</th>
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
                  ${invite.status === 'pending' && invite.expiresAt.getTime() <= Date.now() ? 'expired' : invite.status}<small
                    >Expires ${invite.expiresAt.toISOString()}</small
                  >
                </td>
                <td>
                  ${invite.status === 'pending' ? html`${invitationForm(csrf, 'resend', invite.id)}${invitationForm(csrf, 'revoke', invite.id)}` : 'No pending actions'}
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
    )}
    <h2>Mail delivery attempts</h2>
    <p>
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
