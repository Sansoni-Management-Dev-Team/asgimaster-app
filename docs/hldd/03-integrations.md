# HLDD 03 — Integrations

Status: **Draft v2** (Mark's 5 Oct notes) · Owner: Tom · Updated: 5 Oct 2026

## 1. Purpose and scope

Every external system the API talks to: direction, trigger, credentials, data, and what happens when it's down. All calls go through our API (CON-03); outbound writes go through the outbox and worker from 01 (CON-07, CON-08). Email (SES) and push (Expo) are covered in 01.

**Phasing (D-26).** Phase 1: HubSpot reads, Maxio, Intercom messenger, Mux playback from a seeded catalogue, enquiries kept in our DB and emailed to a CX inbox. Phase 1.5: HubSpot writes (activity, enquiries), Intercom → HubSpot logging, catalogue editing and chapters in `/admin`, events, AaronAI, engagement data.

## 2. Requirements covered

| System | IDs |
| --- | --- |
| HubSpot | ENT-02, ENQ-02, DAT-01, OFF-05, ONB-04 |
| Maxio | ENT-02, ENT-08, OFF-02 |
| Intercom | SUP-01, SUP-02, SUP-03, SUP-04, AAI-06 |
| Mux and content catalogue | LIB-01 – LIB-08, EVT-03, PRO-02, PRO-03 |
| Events calendar | EVT-01, EVT-02 |
| AaronAI | AAI-02, AAI-03 |
| Engagement data | LIB-08, DAT-03 |

## 3. Summary

| System | Direction | Trigger | Credential (SSM) |
| --- | --- | --- | --- |
| HubSpot | Read contacts; write 2 app properties; submit forms | Nightly, on-open, `/admin`; outbox | Private-app token |
| Maxio | Read subscriptions | Webhooks + nightly; go-live backfill | Read-only API key, webhook secret |
| Intercom | App SDK; identity from our API | Member opens support | Identity-verification secret |
| Mux | Read assets; sign playback | Migration import, Mux webhooks, per play | API token, signing key |
| Calendars | Read | Hourly poll | Feed URLs |
| AaronAI | Proxy requests | Member chats | Service credential |

## 4. HubSpot

**Reads.** Batch-read linked contacts and the properties that drive access (which ones: DEP-27). Feeds 02.

**Activity write (DAT-01) — Phase 1.5.** Two app-owned contact properties in an "App" property group, e.g. `app_last_watched_at` (date) and `app_days_inactive` (number), batch-updated nightly. HubSpot scopes are per object type, not per property, so the restriction to these two properties is enforced in our code by an allow-list and covered by a test. Members with no HubSpot record are skipped (ENT-07). This needs contact write scope, which the rebrief ruled out; confirm with Mark (D-04).

**Enquiries (ENQ-02, OFF-05) — Phase 1.5.** In Phase 1 enquiries stay in our DB and are emailed to a CX inbox (ENQ-04). From Phase 1.5 each enquiry is also submitted to a HubSpot form via the Forms API: one form per enquiry type (or one form with a type field), with hidden fields for member ID, enquiry type and context. The submission attaches to the contact by email and triggers CX's existing workflows. The Forms API has no idempotency key, so duplicates are prevented on our side: one outbox row per enquiry, sent once, with a submission marker stored; an ambiguous timeout is retried at most once.

**Keyed on a contact ID (CON-24, proposed).** Every HubSpot write targets a linked HubSpot contact ID; nothing writes by email. Members without a link — the 42 real ones and every synthetic test member (D-34) — produce no HubSpot writes, and their enquiries go to the CX inbox only. This conflicts with the Forms API, which attaches by email: if CON-24 is agreed, enquiries become a note or task on the linked contact instead (needs that object's write scope; revisit in 1.5). Before Intercom's HubSpot sync is switched on, check it doesn't create contacts for unlinked Intercom users.

## 5. Maxio

- Read-only API key and webhooks, for our API only — never the app; never writes (CON-06).
- Phase 1 critical path: the roster is derived from Maxio (02).
- The nightly pull is a full pull, never a delta (CON-21). On a webhook, re-fetch the customer's full current subscription set rather than applying the event (CON-18).
- Webhooks for subscription state changes, renewals and payment success / failure hit `/webhooks/maxio`; the signature is verified; the member's Maxio snapshot is updated and re-resolved (02).
- Nightly reconcile catches missed webhooks; one-off backfill at go-live.
- Needs the client to issue a read-only key and configure webhooks (DEP-26) — contradicts the rebrief's "no Maxio credential".

## 6. Intercom

- **Native SDK** (`@intercom/intercom-react-native` with its Expo config plugin) shows Intercom's own messenger in the app.
- **Identity (SUP-02).** Our API signs a short-lived JWT for the member (Intercom identity verification) with our member ID, email and name; the app logs in to Intercom with it and logs out on sign-out.
- **Entry points.** Shan's support topics open the messenger with a pre-filled message, so the topic still routes.
- **Push on reply (SUP-04).** Intercom needs the native APNs / FCM device token and push credentials uploaded to Intercom; coordinated with Expo push in 04.
- **HubSpot (SUP-03), Phase 1.5.** Intercom's native HubSpot app syncs contacts and logs conversations. Check what the client's plan includes (DEP-21).
- **AaronAI hand-off (AAI-06, TBC).** Opens the messenger with the reviewed snapshot as the first message.

## 7. Mux and content catalogue

**Ownership.** Mark migrates Kajabi → Mux (DEP-05). We import the result into our catalogue (Phase 1 needs at least the cohort-one videos); staff edit it in `/admin` from Phase 1.5.

**Catalogue tables (our DB).**

| Table | Holds |
| --- | --- |
| `collections` | Courses, programmes and recording sets: title, description, artwork, order, capability key, published |
| `lessons` | Title, description, order, artwork, Mux asset and playback IDs, duration, published |
| `chapters` | Lesson, start time, title, source (`ai` or `edited`) |

- **Seed.** An import script reads Mark's Kajabi export (course structure) plus the Mux asset list and creates collections, lessons and chapters.
- **Playback (LIB-02).** Signed playback: the API mints a short-lived Mux playback token only for members holding the collection's capability. Thumbnails and storyboards are signed too.
- **Captions (LIB-03).** Mux auto-generated captions, enabled on each asset during migration; the player shows the text tracks.
- **Chapters (LIB-04, LIB-06, LIB-07), Phase 1.5.** Generated with Mux AI during migration, imported into `chapters`, corrected in `/admin`, served with the lesson. No release to change a title.
- **Durations.** From Mux; used for 90% completion and roll-ups (PRO-02, PRO-03).
- **Mux webhooks.** `video.asset.ready` and related events update status and duration for new uploads.
- **No dead ends (ENT-03).** A collection with no published lessons is never sent to the app.
- **Event recordings (EVT-03).** Lessons in a recordings collection, linked to their event in `/admin`.

## 8. Events calendar (Phase 1.5)

- **One feed per membership audience.** The client maintains a separate calendar for each audience; each feed URL is registered in `/admin` with the capability whose holders can see it.
- `jobs` polls every feed hourly, parses it (format TBC, D-08), and upserts into `events` (UID, title, times, location or online link, description). The same UID in several feeds is one event visible to all of those audiences.
- A member sees an event if they hold any of its feeds' capabilities (EVT-02).
- A feed that fails to load keeps its last import.

## 9. AaronAI (Phase 1.5, D-33)

- **Proxy via our API.** The app calls `/v1/aaronai/*`; our API checks the `aaronai` capability, then calls the AaronAI backend with a service credential and our member ID, and streams the reply back (a Lambda function URL with response streaming for this route if needed).
- **History and plan state (AAI-03).** Stored by the AaronAI backend against our member ID if it supports that; otherwise in our DB. Decided after reviewing the repo (D-12).
- **Limits.** Per-member throttling in our API.
- **Residency.** Inference location is AaronAI's own stack (earlier notes: AWS Bedrock, US, zero retention); state it in the privacy policy.

## 10. Engagement data (D-18, Phase 1.5)

Two options:

| Option | Captures | Effect |
| --- | --- | --- |
| (a) `progress` only | Per-video furthest position, last watched, completion | Simplest. "Days inactive" means days since last video watched. |
| (b) `progress` + `events` | Plus an append-only `events` table for app open, screen views and feature use | "Last app open" and an onboarding funnel become possible; "days inactive" can mean any app use. More volume; still in our DB and visible through the ops views. |

No third-party analytics platform in either option.

## 11. Failure handling

| System down | Effect |
| --- | --- |
| HubSpot | Reads: last snapshot kept (02). Writes: queued and retried; failures on the `/admin` Delivery page |
| Maxio | Missed webhooks caught by the nightly reconcile; access never downgraded on a fetch error |
| Intercom | Messenger unavailable; app shows a fallback contact route |
| Mux | Playback fails gracefully; catalogue still loads |
| Calendar feed | Last import kept |
| AaronAI | Chat shows retry; nothing else affected |

## 12. Decisions

**Made (3 Oct 2026, internal — confirm with Mark where noted)**
- HubSpot activity: two app-owned contact properties (D-04, confirm with Mark).
- Enquiries: HubSpot Forms API submissions.
- Catalogue in our DB, edited in `/admin`; signed Mux playback (D-07).
- Chapters: generated in migration, corrected in `/admin` (D-22).
- Intercom: native SDK; Intercom's HubSpot app for conversation logging (D-17).
- Events: one calendar feed per membership audience (D-08).
- AaronAI: proxied through our API (D-12).

**Open**
- D-18 — engagement data: `progress` only, or `progress` + `events`.
- D-08 — calendar feed format and URLs.
- D-12 — AaronAI API, auth, history ownership and streaming format (repo review).
- Should an enquiry from a member with no HubSpot record create a new contact (the Forms API will)?
- HubSpot forms and properties to create, and who creates them (DEP-28).

## 13. Out of scope

Kajabi (replaced by Mux); writing to Maxio; third-party product analytics; marketing campaigns.
