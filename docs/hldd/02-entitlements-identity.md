# HLDD 02 — Entitlements and identity

Status: **Draft v1** · Owner: Tom · Updated: 3 Oct 2026

## 1. Purpose and scope

Who a member is, and what they can access. Covers linking one person to their HubSpot, Maxio and Klaviyo records; turning their purchases into access; keeping that fresh; staff corrections; and what happens when any of it fails.

Our API owns this end to end. Mark's existing join tables and the offline service that generates them are the reference: we import their output as suggestions and compare against it before launch, and may port or tighten his matching later.

## 2. Requirements covered

| Area | IDs |
| --- | --- |
| Identity | ACC-04, ADM-02, ADM-04, ENT-07 |
| Access | ENT-01, ENT-02, ENT-03, ENT-04, ENT-05, AAI-04, EVT-02 |
| States members see | ACC-05, ENT-08, OFF-02, OFF-07 |
| Rules and corrections | ENT-06, ADM-09 |

## 3. Identity

**One member, many identities.** `members` holds our member ID — the key everywhere. `member_identities` holds every email and upstream ID for that member:

| Field | Notes |
| --- | --- |
| `kind` | `email`, `hubspot_contact`, `maxio_customer`, `klaviyo_profile` |
| `value` | The email or upstream ID |
| `status` | `suggested` → `confirmed` or `rejected` |
| `source` | `csv`, `email_lookup`, `join_table`, `manual` |
| `evidence` | Why it was suggested (e.g. "ID supplied in CSV", "single exact email match in HubSpot", "2 candidates") |
| `confirmed_by`, `confirmed_at` | Staff member and time |

Rules:
- **Nothing links itself.** Imports and lookups only ever create `suggested` links. Only `confirmed` links feed access.
- A confirmed upstream ID belongs to exactly one member (unique constraint); a clash shows as a conflict to resolve.
- A member can sign in with any confirmed email (ACC-04).

**Cohort import and review (ADM-02, ADM-04).**
1. Staff upload a cohort CSV: name, email, and optional `hubspot_id`, `maxio_id`, `klaviyo_id` (from Mark's join tables where known).
2. The API creates `suggested` links from supplied IDs, and looks up HubSpot contacts and Maxio customers by email to suggest more.
3. A review table shows each row with its suggested links, evidence and any conflicts. Staff tick rows, or use "select all with a single exact match", and confirm. Ambiguous rows stay unconfirmed and are handled one at a time on the member page.
4. Every confirmation and rejection is written to `audit_log`.
5. Invites are sent once a row has at least one confirmed upstream link. Staff can force-send; that member lands on "access being set up" (ACC-05) until linked.

## 4. Access

**Capabilities.** Access is a set of capabilities: stable keys for things the app can show, for example `library.collection:<id>`, `events.type:<id>`, `aaronai`, `coaching.contact`. Each can carry an allowance (a number, unlimited or unknown) and a window (start, end). The app renders capabilities and data-supplied labels; it never knows tier or product names (CON-05).

**Rules (ADM-09).** A mapping table in `/admin` turns upstream facts into capabilities:

| Rule part | Example |
| --- | --- |
| Source | HubSpot contact property, HubSpot deal / line-item product, Maxio product or component |
| Match | Property value or product ID |
| Grants | One or more capabilities, with allowance and window |
| Label | Display name for the plan shown on Profile (ENT-05) |

Grants from all of a member's confirmed sources are added together; anything not granted is denied. Rule edits are audited and trigger a full refresh. No release is needed for any rule change (CON-04).

**Corrections (ENT-06).** Staff can grant or remove a capability for one member in `/admin`, with a mandatory reason and an optional expiry. Corrections apply after rules, are flagged in the result for audit, and render like any other capability.

**Resolution.** A pure function:

```
resolve(member, upstream snapshots, rules, corrections, now) → access
```

No I/O, deterministic, fixture-tested. Adapters fetch the inputs (03); the result is stored. Output:

| Field | Notes |
| --- | --- |
| `state` | `active`, `payment_issue`, `wind_down` (with end date), `after_window`, `none` |
| `capabilities[]` | Key, allowance, window, label, source references, correction flag |
| `source_as_at` | Age of the oldest upstream data used |
| `hash` | Change detection; doubles as the ETag for `/v1/me` |

Each result is appended to `access_snapshots` (history: "why did this member lose access on Tuesday?") and copied to `member_access_current`.

**States.**
- `payment_issue` — from Maxio subscription status (e.g. past due). The app shows "please contact us" (ENT-08); access is not removed for this alone.
- `wind_down` — programme has ended within the last 14 days: library capabilities kept, event and coaching capabilities dropped (OFF-02).
- `after_window` — more than 14 days after the end: what remains is a rule decision with Mark (OFF-07).
- `none` — no confirmed links, or nothing granted: the app shows "access being set up" (ACC-05).

The exact mapping from Maxio and HubSpot fields to these states is agreed with Mark and recorded in the rules (§8).

**What the app receives.** `/v1/me` returns profile, `state`, the plan label, and only the capabilities that have content behind them (checked against the catalogue, 03), so the app never shows a dead end (ENT-03). Allowances of "unknown" are sent as such; the app shows "Included" (ENT-04).

## 5. Freshness

| Trigger | What happens |
| --- | --- |
| Maxio webhook | Subscription, renewal or payment events hit `/webhooks/maxio`; signature verified; that member's Maxio snapshot is updated and re-resolved via the queue. Seconds. |
| Nightly | Full pull of linked HubSpot contacts and Maxio subscriptions, then re-resolve everyone. Catches missed webhooks and HubSpot changes. |
| App open | `/v1/me` answers from the current result immediately; if it's older than a few hours, a refresh for that member is queued (throttled). |
| `/admin` | "Refresh now" per member, and automatically after a rule edit. |
| Go-live | One-off backfill of current Maxio subscriptions for every linked member. |

Needs a read-only Maxio API key and webhook configuration from the client (the rebrief says no Maxio credential — §8).

## 6. Failure behaviour

- **Upstream unreachable or erroring:** keep the last snapshot and the last result; mark them stale. A failed fetch never counts as "no subscription" (CON-01).
- **Mass-change guard:** if a refresh would remove access from more than a set share of members at once, stop, keep the previous results and alert.
- **Stale data:** served without warning; nothing in the app implies live billing (CON-02).
- **Device side:** the app keeps the last good `/v1/me` (04).

## 7. Testing

- Unit tests for `resolve` against fixtures for each state, multi-email members, conflicting sources, corrections and expiry.
- Before launch: run every launch-cohort member through our resolver and diff against Mark's join-table output; every difference is explained or fixed.

## 8. Decisions

**Made (3 Oct 2026, internal — confirm with Mark)**
- Our API resolves access (D-01). Mark's service is the reference for suggestions and validation.
- Links are suggested from CSV IDs and email lookups, never auto-confirmed; staff confirm via a bulk review table (D-14).
- Rules live in a mapping table in `/admin` (ADM-09).
- Freshness via Maxio webhooks plus a nightly refresh, on-open refresh and manual refresh (D-02).

**Open**
- Read-only Maxio API key and webhook setup — contradicts the rebrief; Mark to agree (D-02, D-25).
- Which HubSpot properties / objects hold membership, programme and end dates; which Maxio statuses mean `payment_issue` (Mark, finance).
- Is Klaviyo a membership source, or only an identity hint (D-14)?
- What a member keeps after the 14-day window (OFF-07).
- Mass-change guard threshold.
- Analyse Mark's join-table service and decide whether to port its matching.

## 9. Constraints

| Constraint | How it's met |
| --- | --- |
| CON-01 fail to last-known-good | Fetch errors never downgrade; last result kept; device cache in 04 |
| CON-02 tolerate stale data | `source_as_at` tracked, never shown as live billing |
| CON-04 changes are data | Rules and corrections in `/admin`; no release |
| CON-05 no tier names in the app | Capabilities plus data-supplied labels |
| CON-06 never write entitlement upstream | Read-only on HubSpot and Maxio for access |

## 10. Out of scope

Consumption / booking ledger (CON-13); self-registration matched to membership (ACC-07); writing anything back to Maxio.
