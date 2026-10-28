# Authentication, invitations and staff access

## Outcome and scope

An eligible member can enter their own account through an invitation, return without losing their work, and sign out securely. Authorised staff can manage invitations and member support through the staff admin. Member and staff access are separate permissions even when a person holds both.

Requirements: ACC-01, ACC-02, ACC-03, ACC-05, ACC-06, ACC-07; ADM-01, ADM-02, ADM-03, ADM-05, ADM-06; PLT-03, PLT-07; CMP-02. Design choices live in [HLDD 01](../hldd/01-platform-api-admin.md). Membership eligibility inputs and identity matching live in [access and identity](access-identity.md).

## Eligibility and invitation lifecycle

- There is no public signup. Knowing an email address, receiving an unsolicited credential or calling an authentication endpoint directly must not create membership or staff privileges.
- Staff select eligible members from the membership roster. CSV may seed identity references; it is not the ongoing membership roster. A deliberately provisioned test identity must remain distinguishable from a live upstream integration.
- A first invitation is tied to one explicitly linked member and recipient. Staff can see whether it is pending, accepted, expired, revoked or failed to deliver, and can resend or revoke it. A delivery failure must not be shown as successful acceptance.
- Check invite/member eligibility before sending sign-in credentials and again before issuing a session. An expired or revoked invitation cannot be bypassed using a previously issued link or code. A successfully accepted invitation establishes the returning-member path; it must not require endless re-invitation.
- Acceptance, revocation and resending must remain consistent under concurrent requests. Revoking or resending a pending invitation invalidates its outstanding credentials and obsolete queued mail; a later re-invitation cannot revive them. An accepted invitation cannot be revoked as though it were still pending.
- Resending and repeated submissions must not create duplicate memberships or ambiguous login links. Authentication never changes upstream membership or grants capabilities on its own.
- A linked authenticated member whose access is not configured sees the access-being-set-up state. Lack of resolved capabilities is not evidence that a member's identity is invalid.

## Member entry and session states

Members can use a magic link or an emailed one-time code. The code is a usable alternative when an email client cannot open the link correctly. An invitation opened without the app installed offers a safe installation/sign-in fallback. Invalid, expired, already-used or revoked credentials produce a recoverable sign-in state. Unknown/ineligible identities and wrong/expired verification failures have the same public failure response, without revealing membership or staff status. A staff-only identity requesting a member magic link receives the generic response and no member credential email.

A valid native session survives an ordinary app restart. An expired or revoked session requires sign-in again and cannot continue to authorise protected operations. Sign-out revokes only the presented session; independent sessions on other devices remain valid. It clears credentials, cached member data and member associations with support and push on the device. Switching accounts must never expose the previous member's data. See [common device behaviour](member-experiences.md#common-device-behaviour).

The browser review experience uses email-code sign-in and clearly explains that refreshing or reopening the page requires signing in again. Profile and onboarding answers remain saved on the account and are restored after sign-in. Native magic-link delivery must not be offered as desktop browser sign-in.

Every member operation derives identity from the authenticated account's explicit member link. A caller-selected member identifier is not authorisation. A staff session without a member link is not a member account. Ambiguous or absent links must fail safely and provide a recovery route.

Sign-in attempts and credential requests are bounded across service instances. Codes, sign-in links, tokens and member data must not appear in logs. Native credentials use secure device storage. These are security invariants; exact lifetimes and limits belong in reviewed security configuration.

## Staff access

Staff are provisioned through a controlled administrative process. Entering staff admin requires both staff permission and a browser cookie session proven by email code. A person with both member and staff permissions may use either passwordless method for member access, but a magic-link-issued session cannot enter staff admin. Membership alone grants no staff access; clients cannot choose their own roles. Staff features stay outside the member app (ADM-06). Server-side permissions protect both pages and mutations, with CSRF protection for browser mutations. Every staff mutation records actor, time, target, reason where required, and the change made. Identity and access changes retain the stronger audit requirements in their [feature specification](access-identity.md).

### Staff and admin management

Each login has one administrative role: ordinary user, staff or admin. Staff and admins can perform member operations; only admins can view or manage the staff team. Membership is an independent link, so either staff role can coexist with membership.

The Staff & Admin page supports searching and filtering the team, adding a named staff account, changing its role and removing staff access. Adding by email reuses an existing login where present without changing its name, membership or email verification. A new staff-only identity must prove control of its email through the normal sign-in flow. Role changes and removals require an explicit reason and record the acting admin, target and before/after permissions atomically.

Permission checks use current server-side authority, including when the mutation commits. Concurrent changes cannot remove the last unblocked admin or let a newly demoted actor continue administering staff. A stale role-change form requires review rather than silently overwriting a later change. Removing staff access immediately denies staff operations while preserving the login, member link and member data. Account-wide bans, deletion, impersonation and email changes are separate operations, not substitutes for removing staff access. Initial admin provisioning and recovery remain controlled operating procedures.

Credential-bearing links carry a one-time verification credential, never a reusable session. The app exchanges it through the approved sign-in flow; web installation/help fallback is separate and credential-free. Obsolete queued codes are cancelled when replaced. Staff can direct the member to request a fresh code rather than treating an expired credential as deliverable.

Transport acceptance is not proof that email reached the inbox. Staff-facing states must distinguish queued/sent work, failures and expiry without implying delivery confirmation.

## Invitation release gate

D-01 and PLT-07 require a restore rehearsed from a real backup into an empty database **before the first member invitation**. This includes synthetic member invitations; a healthy service or successful local migration is not restore evidence. Isolated captured-mail verification does not satisfy this release gate. Live email sending, bounce/complaint handling and reviewed secret, trust and network configuration must also be verified before release; local mail capture proves only the local flow. Keep verification evidence outside `docs/`.

The store reviewer has a permanent, fully entitled demo account with a static code that needs no email (PLT-03, CMP-02). This is a bounded reviewer experience, never a general authentication bypass or a way to access real member data.

## Acceptance criteria

- An invited eligible member can sign in using either supported method, reopen the app and reach their own account.
- Unknown, uninvited, expired and revoked first-time identities cannot obtain a member session through any exposed authentication entry point. Wrong, expired and replayed credentials fail safely.
- Two members cannot read or change one another's profile, onboarding or cached data. A staff identity alone cannot impersonate a member.
- Member permission alone cannot access staff operations. Dual-role member magic sign-in works for member access but fails staff entry; staff entry requires an email-code-proven browser session. Unauthorised staff mutations fail and authorised ones are audited.
- Failed delivery, resend and revoke have truthful, recoverable staff states. Concurrent actions cannot revive old credentials or duplicate identities/invitations, and transport acceptance is not represented as inbox confirmation.
- Sign-out makes the presented session unusable and clears that device's member data and associations while leaving independent device sessions valid.
- The invitation gate has recorded restore evidence before invitations are enabled.

## Unresolved choices

- Session renewal and credential lifetimes, resend policy and attempt limits require security review; a long-lived session duration previously suggested is not an approved product duration.
- D-19: account deletion route and its relationship to retained membership/progress and regulatory obligations. Programme offboarding is not account deletion.
- Initial staff ownership, invitation sender identity and production app-link/domain approval must be assigned through operating procedures. They do not reopen the selected authentication platform.
