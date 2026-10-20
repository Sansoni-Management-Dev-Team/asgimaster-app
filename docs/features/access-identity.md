# Access and identity

## Outcome and sources of truth

Members receive the access they hold without one person's identity, activity or content leaking into another account. Staff can explain and correct a result without losing its history.

Requirements: ACC-04, ACC-05; ADM-02, ADM-03, ADM-04, ADM-09, ADM-10, ADM-11; ENT-01–ENT-10; AAI-04, EVT-02; OFF-02, OFF-03, OFF-07; PLT-08, PLT-09; PRO-04. Decisions D-01, D-02 and D-14 and constraints CON-01, CON-02, CON-04–CON-06, CON-15–CON-23 govern this feature. [HLDD 02](../hldd/02-entitlements-identity.md) explains the design boundary.

| Question                                           | Authority                                      |
| -------------------------------------------------- | ---------------------------------------------- |
| Who has an in-scope membership?                    | Maxio                                          |
| What upstream identity facts describe this person? | HubSpot                                        |
| Which login belongs to which member?               | The application's explicit identity assertions |

Klaviyo is not an identity or membership source. A Maxio member without a HubSpot record is an ordinary member (ENT-07); a HubSpot-only contact is not thereby a member. Access resolution never writes to Maxio or HubSpot (CON-06).

## Identity and roster

A member record is established when a person appears with an in-scope Maxio subscription and is retained when they leave (CON-19). A returning person must recover the same member identity and progress. Multiple subscriptions do not imply multiple people.

Deterministic derived matches may use exact email equality and the client's crosswalk references. Human link/unlink assertions take precedence over derived matches and are append-only, recording actor, time, reason and evidence. The client's adjudicated merges must be preserved as assertions with their provenance; they are not permission to infer other merges.

An ambiguous match never links or merges itself (CON-16). Different emails, approximate names/phones and multiple candidates require human review. Staff must be able to inspect and manually link/unlink records (ADM-04); bulk suggested-link review (ADM-10) and a standing no-HubSpot report (ADM-11) support the same policy. A bad merge is a member privacy incident.

The staff roster is a refreshed view of in-scope Maxio membership with identity references. It is not maintained by recurring CSV imports. Staff invitation behaviour is defined in [authentication](authentication.md).

## Capabilities and member states

The API supplies stable capabilities, allowances, windows and display labels. The app does not encode membership tier names or rules (CON-05). Capabilities are unioned across linked subscriptions; when the same capability is granted more than once, use the larger allowance rather than adding allowances. Unknown allowances never become zero and display as “Included” (ENT-04). Mixed allowance semantics must conform to the client suite.

Only actionable included content is presented: an empty collection or unavailable feature must not create a dead-end entry (ENT-03). The server checks access when serving protected data or playback, rather than relying on hidden navigation.

| State           | Required member experience                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| `active`        | Included capabilities and data-supplied membership label                               |
| `payment_issue` | Contact-support explanation; this status alone does not remove access                  |
| `none`          | “Access being set up”, with account/support recovery rather than invented capabilities |
| `wind_down`     | A clear Home banner and explanation of what access remains and for how long            |
| `after_window`  | An honest explanation of access after the applicable window                            |

Source-field mappings, wind-down windows and after-window entitlements must be agreed before those states can be resolved truthfully. A cancelled member holds no access in the client's cancellation conformance case; do not use that case to invent the unresolved wind-down policy. A member's [leaving enquiry](../offboarding.md) does not itself change any state.

## Rules and corrections

Rules map upstream products and facts to capabilities and a plan label. Changes are versioned and append-only, record who/when/why, and preview the affected members and gains/removals before saving (ADM-09, CON-04). Saving triggers resolution using the new rule version. Staging does not replace preview-before-save.

A correction grants or removes a capability for one member after rules have applied. A reason and expiry are mandatory; amendments append a new record rather than rewriting history (ENT-06, CON-17). Staff see provenance and expiring corrections; members see the resulting capability consistently with other access. D-01 sets a default expiry of 90 days; staff must still supply an explicit expiry for every correction. Changing that business policy requires an explicit decision.

Resolution is pure and deterministic: identical member inputs, source snapshots, rules, corrections and evaluation time produce canonically identical results (CON-15). Results retain source freshness, rule version and correction/source provenance for staff explanation and audit. These are product invariants, not a prescribed payload or table schema.

## Refresh and failure containment

D-02 requires source-change webhooks, a full nightly reconciliation, a throttled stale-on-open refresh and a staff refresh action. Webhooks trigger a re-fetch of the full current subscription set, never an event delta (CON-18). Cancellation-only changes wait for an agreed settle window so a tier upgrade represented as cancel-plus-new-subscription does not flicker access. The recurring reconciliation is a full pull (CON-21).

Validate source completeness before resolution (CON-20). A zero-row or suspiciously incomplete pull aborts without removing anyone's last good access. Source age alone is not a failed fetch; stale inputs retain access and trigger an operational alert. An upstream error never means that missing memberships own nothing.

The removal brake evaluates cumulative changes over a rolling period, including webhook-driven changes (CON-22). When it trips, hold removals while permitting grants. Final thresholds remain D-37; proposed numerical thresholds are not approved production policy. Staff must see what was held and why.

Operational data-health signals are separate from crash reporting (CON-23, PLT-09): a synthetic access pull, the age of the oldest member payload and held resolution runs. Staff receive these signals in admin and by email. Each resolution run must be explainable, including input checks, changed members and held changes.

Device fallback and account isolation are canonical in [common device behaviour](member-experiences.md#common-device-behaviour). CON-02 requires no misleading live-billing claim or generic staleness warning in the member experience.

## Acceptance and conformance

D-01 places the resolver and staff rules in this application subject to five conditions: the [restore-before-invite gate](authentication.md#invitation-release-gate), attributed and previewed rule changes, the client's conformance suite as acceptance, append-only corrections with mandatory expiry, and client ownership of the reference implementation and suite.

ENT-09 requires the client-owned suite to run against the resolver in CI on every change using an agreed pinned version. A failure blocks deployment. Coverage must include empty inputs removing nobody, unknown allowances remaining unknown, maximum rather than summed allowances, the cancellation case, a correction affecting exactly the intended member and deterministic output. Supplement it for assertion precedence, settling and preview behaviour. Before inviting a cohort, compare every cohort member with the client's crosswalk and explain or fix every discrepancy.

Acceptance also requires:

- Ambiguous identities remain unlinked; asserted unlinks win over derived matches; returning members keep identity and progress.
- Missing HubSpot records do not disqualify Maxio members or generate fabricated identity links.
- Payment issues alone do not revoke access, and unconfigured access displays truthfully.
- Rule preview accurately describes gains/removals; corrections expire and retain a complete audit trail.
- Incomplete input, stale sources and repeated small removal events cannot silently strip the member base. A brake hold still permits legitimate grants.
- The client gates access using resolved capabilities; no tier logic or third-party credentials are embedded in the app.

## Unresolved choices

- DEP-27: exact in-scope Maxio products and Maxio/HubSpot fields that drive states, capabilities and labels; wind-down/after-window rules also need agreement (D-09).
- DEP-26: read-only Maxio access, including relevant AU/NZ accounts, and webhook authority.
- D-30: partner-seat representation and whether each seat has a distinct member/login/progress record; distinct records are proposed, not agreed.
- D-31: client conformance format and pinned suite delivery. Language-neutral fixtures are proposed.
- D-36: who operates/builds corrections, application admin or the client's console, without weakening D-01 audit and expiry requirements.
- D-37: completeness floor, stale-input alerts, rolling-brake period/thresholds, cancellation settle interval and device fallback trust period.
- CON-25: reviewed whole-base access diff before resolver code deployment is proposed in addition to required rule previews.
- D-34 and CON-24: see the proposed test-member/write-isolation policy and enquiry conflict in [HLDD 03](../hldd/03-integrations.md#unresolved-integration-choices).

Consumption and booking ledgers (CON-13), public self-registration (ACC-07) and upstream membership writes are outside this feature.
