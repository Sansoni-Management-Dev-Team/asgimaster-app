# Authentication, invitations and staff access

## Outcome and scope

An eligible member can enter their own account through an invitation, return without losing their work, and sign out securely. Authorised staff can manage invitations and member support through the staff admin. Member and staff access are separate permissions even when a person holds both.

Requirements: ACC-01, ACC-02, ACC-03, ACC-05, ACC-06, ACC-07; ADM-01, ADM-02, ADM-03, ADM-05, ADM-06; PLT-03, PLT-07; CMP-02. Design choices live in [HLDD 01](../hldd/01-platform-api-admin.md). Membership eligibility inputs and identity matching live in [access and identity](access-identity.md).

## Eligibility and invitation lifecycle

- There is no public signup. Knowing an email address, receiving an unsolicited credential or calling an authentication endpoint directly must not create membership or staff privileges.
- Staff select eligible members from the membership roster. CSV may seed identity references; it is not the ongoing membership roster. A deliberately provisioned test identity must remain distinguishable from a live upstream integration.
- A first invitation is tied to one explicitly linked member and recipient. Staff can see whether it is pending, accepted, expired, revoked or failed to deliver, and can resend or revoke it. A delivery failure must not be shown as successful acceptance.
- Check invite/member eligibility before sending sign-in credentials and again before issuing a session. An expired or revoked invitation cannot be bypassed using a previously issued link or code. A successfully accepted invitation establishes the returning-member path; it must not require endless re-invitation.
- Resending and repeated submissions must not create duplicate memberships or ambiguous login links. Authentication never changes upstream membership or grants capabilities on its own.
- A linked authenticated member whose access is not configured sees the access-being-set-up state. Lack of resolved capabilities is not evidence that a member's identity is invalid.

## Member entry and session states

Members can use a magic link or an emailed one-time code. The code is a usable alternative when an email client cannot open the link correctly. An invitation opened without the app installed offers a safe installation/sign-in fallback. Invalid, expired, already-used or revoked credentials produce a recoverable sign-in state. Responses to unknown addresses must not reveal membership or staff status.

A valid session survives an ordinary app restart. An expired or revoked session requires sign-in again and cannot continue to authorise protected operations. Sign-out revokes that session and clears credentials, cached member data and member associations with support and push on the device. Switching accounts must never expose the previous member's data. See [common device behaviour](member-experiences.md#common-device-behaviour).

Every member operation derives identity from the authenticated account's explicit member link. A caller-selected member identifier is not authorisation. A staff session without a member link is not a member account. Ambiguous or absent links must fail safely and provide a recovery route.

Sign-in attempts and credential requests are bounded across service instances. Codes, sign-in links, tokens and member data must not appear in logs. Native credentials use secure device storage. These are security invariants; exact lifetimes and limits belong in reviewed security configuration.

## Staff access

Staff are provisioned through a controlled administrative process and sign in by email code. Membership alone grants no staff access; clients cannot choose their own roles. Staff features stay outside the member app (ADM-06). Server-side permissions protect both pages and mutations, with CSRF protection for browser mutations. Every staff mutation records actor, time, target, reason where required, and the change made. Identity and access changes retain the stronger audit requirements in their [feature specification](access-identity.md).

## Invitation release gate

D-01 and PLT-07 require a restore rehearsed from a real backup into an empty database **before the first member invitation**. This includes synthetic member invitations; a healthy service or successful local migration is not restore evidence. Isolated captured-mail verification does not satisfy this release gate. Keep the rehearsal evidence outside `docs/`.

The store reviewer has a permanent, fully entitled demo account with a static code that needs no email (PLT-03, CMP-02). This is a bounded reviewer experience, never a general authentication bypass or a way to access real member data.

## Acceptance criteria

- An invited eligible member can sign in using either supported method, reopen the app and reach their own account.
- Unknown, uninvited, expired and revoked first-time identities cannot obtain a member session through any exposed authentication entry point. Wrong, expired and replayed credentials fail safely.
- Two members cannot read or change one another's profile, onboarding or cached data. A staff identity alone cannot impersonate a member.
- A member cannot access staff operations; unauthorised staff mutations fail and authorised ones are audited.
- Failed delivery, resend and revoke have truthful, recoverable staff states; retries do not duplicate identities or invitations.
- Sign-out makes the old session unusable and clears the device's member data and associations.
- The invitation gate has recorded restore evidence before invitations are enabled.

## Unresolved choices

- Session renewal and credential lifetimes, resend policy and attempt limits require security review; a long-lived session duration previously suggested is not an approved product duration.
- D-19: account deletion route and its relationship to retained membership/progress and regulatory obligations. Programme offboarding is not account deletion.
- Initial staff ownership, invitation sender identity and production app-link/domain approval must be assigned through operating procedures. They do not reopen the selected authentication platform.
