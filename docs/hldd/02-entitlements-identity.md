# HLDD 02 — Entitlements and identity

Status: **Draft v2** (Mark's 5 Oct review) · Owner: Tom · Updated: 5 Oct 2026

## 1. Purpose and scope

Who a member is, and what they can access. Covers where membership and identity come from, how logins map to members, turning purchases into access, keeping that fresh through a constantly moving member base, staff rules and corrections, and what happens when any of it fails.

Our API resolves access, with rules held in `/admin` (D-01, agreed 5 Oct with five conditions — §9). The client's reference implementation and conformance suite stay in the client's repo; the suite is our acceptance test (§8).

## 2. Requirements covered

| Area | IDs | Phase |
| ----------------------------------------- | ---------------------------------------------- | ------- |
| Identity and roster | ACC-04, ADM-02, ADM-03, ADM-04, ENT-07 | 1 |
| Access | ENT-01, ENT-02, ENT-03, ENT-04, ENT-05, ENT-08 | 1 |
| Rules, corrections, conformance | ADM-09, ENT-06, ENT-09 | 1 |
| Failure containment, test members, gauges | ENT-10, PLT-08, PLT-09 | 1 |
| States | ACC-05 (1); OFF-02, OFF-07 (1.5) | 1 / 1.5 |
| Bulk review, no-HubSpot report | ADM-10, ADM-11 | 1.5 |
| Gated features | AAI-04, EVT-02 | 1.5 |

## 3. Sources of truth (D-14)

| Question | Answered by |
| ------------------------------------ | --------------------------------------- |
| Who is a member? | **Maxio** |
| Who is this person? | **HubSpot** |
| Which login belongs to which member? | **Us** — an assertion, not a derivation |

Klaviyo is not a source. Because Maxio decides membership, members with no HubSpot record (42 of 341 today, a moving ~12%) are ordinary members, not an edge case (ENT-07). The two HubSpot-only records are not members.

## 4. Identity

**Member records.** A member record is created the first time a person appears in Maxio with an in-scope subscription, and is never deleted (CON-19). People leave and return constantly (net exit ~31% a year, and a tier change looks like a cancel plus a new subscription), so a returning member must resolve to the same record, with progress intact (PRO-04).

**Two kinds of link** between a member and upstream records:

| Kind | What | Stored as |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Derived** | Deterministic, rebuildable matches: Maxio customers sharing one exact email (171 of 341 have duplicates, up to 12 subscriptions on one address); refs from the client's crosswalk | Recomputed on every refresh; never treated as truth on their own |
| **Asserted** | A person saying two records are the same member (or not): Mark's 7 adjudicated merges (seeded with method and confidence), and staff link / unlink in `/admin` | `identity_assertions`, append-only: member, record, link or unlink, who, when, why, evidence. A change is a new row |

Current links = derived links, plus asserted links, minus asserted unlinks. Assertions win.

**The rule we don't trade (CON-16):** an ambiguous match never links itself. Different emails, name or phone similarity, or several candidates stay unlinked until a person asserts the link. A bad merge shows one member another member's content — an incident, not a defect.

**Roster (ADM-02).** A live view of in-scope Maxio members with their HubSpot refs, refreshed with Maxio (§6). Staff choose who to invite; inviting is the only manual act. CSV is used once, to seed refs and Mark's merges — not as the roster.

**Phase 1:** roster with HubSpot and Maxio refs, the 7 merges seeded, manual link / unlink (ADM-04). **Phase 1.5:** bulk review of suggested links (ADM-10) and a standing report of members with no HubSpot record (ADM-11).

**Open:** partner seats (D-30) — how they appear in Maxio, and whether each seat holder is their own member record (proposed: yes, with their own login and progress).

## 5. Access

**Capabilities.** Stable keys for things the app can show, e.g. `library.collection:<id>`, `events.type:<id>`, `aaronai`, `coaching.contact`. Each may carry an allowance (a number, `UNLIMITED` or `UNKNOWN`) and a window. The app renders capabilities and data-supplied labels only (CON-05).

**Combining sources.** A member's capabilities are the union across their linked subscriptions. Where two grant the same capability, the allowance is the **larger, not the sum**. `UNKNOWN` never becomes zero. Exact merge semantics for mixed allowances follow the conformance suite.

**Rules (ADM-09).** A mapping table in `/admin` turns Maxio products and HubSpot facts into capabilities and a plan label. Rules are versioned and append-only. Every change:

- records who, when and why;
- shows, before it saves, how many members gain or lose what (computed by running the resolver against current data with the draft rules);
- triggers a full re-resolve once saved.

One tired edit can't quietly strip two hundred people.

**Corrections (ENT-06, CON-17).** Grant or remove a capability for one member. Reason mandatory; expiry mandatory, default 90 days. Append-only — editing a correction adds a new row. Corrections apply after rules and are flagged in the result for audit; the member sees them like any other capability. An "expiring soon" list sits in `/admin`.

**Resolution.**

```
resolve(member, upstream snapshots, rules version, corrections, now) → access
```

Pure: no I/O, no clock beyond `now`, no randomness. Deterministic — the same inputs produce the same bytes (CON-15): output is canonically serialised (sorted keys, stable ordering, fixed number and date formats) and hashed. Output: `state`, capabilities (key, allowance, window, label, source refs, correction flag), `source_as_at`, `rules_version`, `hash`. Each result is appended to `access_snapshots` and copied to `member_access_current`.

**States.** `active`; `payment_issue` (from Maxio status — "please contact us", access not removed for this alone); `wind_down` and `after_window` (Phase 1.5, OFF-02, OFF-07); `none` → "access being set up" (ACC-05). Which Maxio fields drive each is agreed with Mark (DEP-27).

**What the app receives.** `/v1/me`: profile, state, plan label, and only capabilities with content behind them (ENT-03). `UNKNOWN` allowances are sent as such; the app shows "Included" (ENT-04).

## 6. Freshness

| Trigger | What happens |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maxio webhook | Re-fetch that customer's **full current subscription set** and re-resolve — never apply the event as a delta (CON-18). A cancellation-only event waits a short settle window first, so an upgrade (cancel + new subscription) doesn't flicker access. |
| Nightly | Full pull of in-scope Maxio subscriptions and linked HubSpot contacts; roster refreshed; everyone re-resolved. |
| App open | `/v1/me` answers immediately; a stale result queues a throttled refresh for that member. |
| `/admin` | "Refresh now" per member; full re-resolve after a rule change. |
| Go-live | One-off backfill of current Maxio subscriptions. |

Needs the read-only Maxio key and webhooks (DEP-26) — now Phase 1 critical path, since the roster comes from Maxio.

## 7. Failure containment

A mistake in entitlement can be caught in three places. All three safeguards remain required (numbers are placeholders in D-37). The original no-staging assumption is superseded: `develop` is staging, deployed from `main`; see the [current handoff](../member-api.md).

**Net 1 — before it ships.** Staging now exists; it does not replace these safeguards:

- Rule changes: preview-before-save in `/admin` (§5) remains mandatory.
- Resolver code changes: a whole-base access diff against current results, reviewed before deploy (CON-25, proposed).
- Test members are synthetic people with no HubSpot ID, and every HubSpot write is keyed on a linked contact ID, so test activity has nothing to write to (D-34, CON-24). One CX-owned real test contact outside the 341 exercises the write path.

**Net 2 — at resolve time (CON-20, CON-21, CON-22).** Checked before anything resolves:

- Zero rows → abort.
- Row-count floor: a full pull returning fewer than 97% of the last good pull's subscriptions → abort. A partial pull isn't less data; it's a claim that the missing members hold nothing.
- An aborted run leaves yesterday's results in place.
- Age is not failure: keep serving, but alert if the newest good full pull is older than 26 hours.
- The nightly pull is always a **full** pull, never a delta — a webhook that never arrives looks exactly like one saying nothing changed.
- **Brake over a rolling 24 hours**, not per run, because webhooks turn one nightly change into many small ones: trips at 15% of the base changed or 25 capability removals (5-person floor). When tripped, removals are held and grants go through — a false hold on a removal leaves someone with access a day longer; a held grant would hide what someone has paid for.

**Net 3 — at render time (CON-01).** The app keeps the last good `/v1/me`. It's trusted for 7 days without a successful refresh; after that the app falls back to the wind-down view — library kept, events and coaching hidden. Nobody is locked out.

**Gauges (CON-23, PLT-09).** Last-known-good hides outages, and a brake trip is the system working correctly, so neither reaches crash reporting. Three cheap signals, each shown in `/admin` and emailed:

- a synthetic access pull on a test member;
- the age of the oldest member payload;
- any held run, with what it held.

Every resolve run writes a row to `resolve_runs` (trigger, input counts, checks passed or failed, members changed, held, outcome). This is separate from member engagement events (D-18).

**Stale data** is served without warning; nothing implies live billing (CON-02).

## 8. Acceptance and conformance (ENT-09)

- **Conformance suite.** The client's 24 scenarios — e.g. a zero-row Maxio pull strips no one; `UNKNOWN` never becomes zero; two tiers merge to the larger, not the sum; a cancelled member holds nothing; an override moves exactly one person; the same inputs produce the same bytes — run against `resolve()` in our CI on every change. A failure blocks deploy. The suite and reference implementation live in the client's repo; our CI pulls a pinned version. Format proposed in D-31: language-neutral JSON fixtures (inputs + expected output), compared after canonical serialisation.
- **Unit tests** for everything the suite doesn't cover (assertion precedence, settle window, rule preview).
- **Before cohort one:** resolve every cohort-one member and diff against the client's crosswalk; every difference explained or fixed.

## 9. Decisions

**Agreed (5 Oct 2026, Mark)**

- D-01: our API resolves, rules in `/admin`, with five conditions — (1) restore rehearsed from a real backup into an empty database before the first invite; (2) rule changes record who / when / why and preview members affected; (3) the client's 24 scenarios are the acceptance suite in our CI; (4) correction expiry mandatory, default 90 days, append-only; (5) reference implementation and suite stay in the client's repo.
- D-02: Maxio webhooks plus nightly, on-open and manual refresh. The Maxio key is for our API only (the rule is no third-party credential in the app); the nightly pull is a full pull.
- D-14: Maxio = membership; HubSpot = identity; login ↔ member is ours, as assertions. No Klaviyo. Ambiguous matches never auto-merge.

**Open**

- D-30 partner seats · D-31 conformance suite format · D-34 test members (proposed: synthetic, no HubSpot ID) · D-36 who builds overrides (our `/admin` per D-01, or Mark's console per CX idea 8) · D-37 thresholds · DEP-27 which Maxio / HubSpot fields drive states and rules · settle window length · which Maxio products are "in scope".

## 10. Constraints

| Constraint | How it's met |
| ------------------------------- | ---------------------------------------------------------- |
| CON-01 last-known-good | Failed or empty fetches never downgrade |
| CON-02 stale data | `source_as_at` tracked; never shown as live billing |
| CON-04 changes are data | Versioned rules and corrections in `/admin`, with preview |
| CON-05 no tier names in the app | Capabilities plus data-supplied labels |
| CON-06 never write upstream | Read-only on Maxio and HubSpot for access |
| CON-15 deterministic | Pure resolver, canonical serialisation, hash |
| CON-16 no ambiguous auto-merge | Derived vs asserted links; assertions append-only |
| CON-17 corrections expire | Mandatory reason and expiry, default 90 days |
| CON-18 no gaps on tier change | Full-set re-fetch, settle window |
| CON-19 never delete members | Same record on return |
| CON-20 input checks | Zero rows, row-count floor, abort leaves yesterday |
| CON-21 full pull | Nightly pull is never a delta |
| CON-22 brake | Rolling 24 hours; hold removals, pass grants |
| CON-23 gauges | Canary pull, oldest-payload age, held runs; `resolve_runs` |
| CON-25 code diff | Whole-base access diff before resolver deploys (proposed) |

## 11. Out of scope

Consumption / booking ledger (CON-13); self-registration (ACC-07); writing to Maxio.
