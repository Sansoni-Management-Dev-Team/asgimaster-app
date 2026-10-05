# HLDD 04 — Member app

Status: **Draft v2** (Mark's 5 Oct notes) · Owner: Tom (client, hooks) / Shan (screens) · Updated: 5 Oct 2026

## 1. Purpose and scope

The Expo app moves from device-local demo data to the real API. This doc covers how: what is kept from the prototype and what is rebuilt, the API client and auth on device, caching and offline behaviour, writes, push, links, video, support, errors, updates and builds. Screen-level UX stays in the module docs (`../offboarding.md`, `../aaronai-ui.md`, `../phase-2-visual-alignment.md`).

## 2. Requirements covered

| Area | IDs |
| --- | --- |
| Platform and release | PLT-01, PLT-02, PLT-03, DEL-08 |
| Sign-in | ACC-01, ACC-02, ACC-05, ACC-06 |
| Screens | ONB-*, HOM-*, PRG-*, LIB-01 – LIB-04, EVT-01, EVT-04, AAI-01, AAI-05, SUP-01, ENQ-01, OFF-* |
| Membership display | ENT-01, ENT-03, ENT-04, ENT-05, ENT-08 |
| Push | NOT-01, NOT-02, NOT-03 |
| Compliance | CMP-01, CMP-02, CMP-03 |
| Design | DES-01, DES-02 |
| Clean-up | HOM-05, EVT-06, LIB-10 |

## 3. Approach

Each module is **rebuilt against the API**, using the current prototype as the visual and behavioural reference. Kept as-is: the design tokens and shared components (`AppButton`, `AppField`, `AppScreen`, `AppText`, `MemberHeader`), the Concept 2 onboarding visuals, and Shan's AaronAI chat / plan UI. Rebuilt: every store, model and fixture behind them.

**Phase 1 — one honest session (D-26):** sign-in, onboarding (answers saved to the account), Home, Profile with sign out, Library and player with progress, Support via Intercom, the enquiry form. Events, AaronAI, offboarding, push and notification preferences follow in Phase 1.5; their tabs and entry points are hidden in Phase 1 builds through remote config, so nothing leads to a dead end (ENT-03).

**Deleted in sprint 1** (once Mark confirms, D-11): event registration, cancellation, QR / wallet / offline passes, check-in and attendance; locked "Not included" and "Explore all" library views; demo settings and presets; simulated support replies and the local support inbox; AaronAI demo scenarios; sample fixtures. Weekly actions, notes and the plan editor wait on D-10.

| Module | Keep from prototype | Rebuild on | Owner |
| --- | --- | --- | --- |
| Invitation and sign-in | Envelope / letter visuals | Better Auth client: magic-link handler + code entry | Tom (auth), Shan (screens) |
| Onboarding | Question screens and motion | `PUT /v1/me/onboarding` | Shan |
| Home | Layout, empty state | `/v1/me`, `/v1/progress`, `/v1/events` | Shan |
| Profile and membership | Card and screen layout | `/v1/me` (state, plan label, capabilities); card ID / expiry per D-20 | Shan |
| Library and player | Collection and player UI | `/v1/catalogue`, `/v1/lessons/:id` (signed playback, chapters, captions), progress writes | Shan, Tom (player plumbing) |
| Events | List and detail only | `/v1/events` | Shan |
| AaronAI | Chat and plan UI | `/v1/aaronai/*` (streamed) | Shan, Tom (stream client) |
| Support | Topic entry list | Intercom SDK | Tom |
| Enquiries | Offboarding callback form as the base | One enquiry form → `POST /v1/enquiries` | Shan |
| Offboarding | Member-initiated flow | Enquiries; plus wind-down banner, What you keep, after-window screens (new designs) | Shan |
| Notifications | Preferences screen | Permission at a moment of value; `POST /v1/push-tokens` | Shan, Tom |

## 4. Structure

**API client (`src/lib/api`).** Fetch wrapper: bearer token from SecureStore, request / response types and zod schemas from `packages/contracts`, ETag on `/v1/me`, an `Idempotency-Key` header on every write.

**Auth.** Better Auth's Expo client. Magic links arrive as universal / app links handled by Expo Router; the code-entry screen is the fallback. Session token in SecureStore. Sign-out revokes the session, then clears the token, the member's cache, the push token registration and the Intercom session.

**Server state.** TanStack Query hooks per module (`src/features/<module>/api.ts`). Zustand only for session and UI state (as AGENTS.md says).

**Device cache (CON-01, CON-11).** The query cache is persisted to MMKV in a namespace keyed by member ID, wiped on sign-out. Long cache lifetimes; a failed refetch never clears data — the app keeps showing the last good result, without a staleness warning (CON-02). It's trusted for 7 days without a successful refresh; after that the app falls back to the wind-down view — library kept, events and coaching hidden — so nobody is locked out (D-37). Only actions that need the live API (AaronAI chat, sending an enquiry) show a "try again" state.

**Writes.** Mutations carry a client-generated idempotency key. Progress is sent throttled (on pause, background, and every ~15 s while playing). Paused mutations are persisted and resumed when the network returns, so progress and enquiries survive going offline.

**Access gating.** Screens render only from `/v1/me`: `state`, plan label, and capabilities, through a single `can(capability)` helper. No tier names or tier logic in the app (CON-05). Unknown allowances show "Included" (ENT-04). `state: none` → "access being set up" (ACC-05); `wind_down` → Home banner (OFF-03).

**Remote config.** `/v1/config` (cached like everything else) supplies the AaronAI product name (AAI-05), support topics and other copy that may change without a release.

**Video.** `expo-video` playing Mux HLS with a signed token from the API; caption tracks from Mux; chapters from the lesson payload as scrubber markers and a list; 90% completion is computed server-side from reported positions (PRO-02).

**Support.** `@intercom/intercom-react-native` via its config plugin; the app logs in to Intercom with a JWT from `/v1/intercom/token`; topics open the messenger with a pre-filled message.

**Push.** `expo-notifications`. Permission asked at a moment of value, never on first open (NOT-02). The Expo push token goes to our API; the native device token goes to Intercom for support replies. Tapping a notification deep-links via Expo Router.

**Links.** Universal links / Android app links on the API domain (files served by the API, 01) for magic links, lessons, events and support.

**Errors.** Sentry React Native with source maps uploaded by EAS; PII scrubbed.

**Updates and builds.**
- EAS Build profiles: `development` (dev client), `preview` (TestFlight / Play internal), `production` (stores). All point at the single production API (01); testers use flagged test members.
- EAS Update on a `production` channel for JS-only fixes between store reviews (CON-12); native changes ship as store builds.

## 5. Key flows

1. **First launch from an invite.** Link opens the app → magic link verified → onboarding → Home. If the app isn't installed, the link's web fallback shows the TestFlight / store link and the sign-in code.
2. **Returning launch.** Cached `/v1/me` renders immediately; revalidated in the background.
3. **API unreachable.** Cached data stays on screen; writes queue; live-only actions show "try again".
4. **Access changes.** Next `/v1/me` refresh changes what's shown — e.g. the wind-down banner appears.
5. **Sign-out.** Session revoked; member cache, push registration and Intercom session cleared.

## 6. Non-functional requirements

- Cached content on screen within about a second of launch.
- Works offline for anything already loaded; no data loss for queued writes.
- Accessibility checked on real devices before release (DES-02).
- No member data in logs or push payloads.
- Minimum iOS / Android versions: Expo SDK 57 defaults (confirm before store submission).

## 7. Constraints

| Constraint | How it's met |
| --- | --- |
| CON-01 fail to last-known-good | Persisted query cache; errors never clear data |
| CON-05 no tier names | Capabilities, plan label and copy come from the API |
| CON-11 member-scoped device data | MMKV namespace per member, wiped on sign-out; tokens in SecureStore |
| CON-12 over-the-air updates | EAS Update, `production` channel |

## 8. Ownership

- **Tom:** API client, contracts, auth and session, per-module hooks, push registration, Intercom and Mux plumbing, AaronAI stream client, build and OTA pipeline.
- **Shan:** rebuild each module's screens on the hooks; new screens (access being set up, wind-down banner, What you keep, after the window, chapters, enquiry form, programme next steps, push opt-in); sprint-1 deletions.
- **Sam:** designs for the new screens (DEP-19).

## 9. Decisions

**Made (3 Oct 2026)**
- Rebuild modules against the API, prototype as reference.
- Persisted TanStack Query cache in MMKV, per member.
- Delete out-of-scope prototype features in sprint 1 (pending Mark, D-11).
- Tom builds client and hooks; Shan builds screens.

**Proposed (to confirm)**
- EAS Update on; `/v1/config` for remote copy and the product name; Sentry.

**Open**
- D-09 offboarding paths · D-10 Home extras · D-13 AaronAI name · D-20 card details · D-21 onboarding answers · D-26 V1 vs Phase 1.
- Keep the app at the repo root or move to `apps/mobile` (01).

## 10. Out of scope

Offline downloads (LIB-09), in-app purchase (CMP-01), staff features in the app (ADM-06).
