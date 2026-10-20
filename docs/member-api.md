# Member API — implementation handoff

Updated: 20 October 2026. Next work agreed with Tom: build the member API.

## Read this before planning or implementing

The server architecture and Phase 1 scope are already recorded in the [HLDD index](hldd/README.md), [platform/API/admin design](hldd/01-platform-api-admin.md), [identity and access design](hldd/02-entitlements-identity.md), [integrations design](hldd/03-integrations.md) and [member app contract expectations](hldd/04-member-app.md). Start from those decisions; extend them with implementation detail rather than restarting architecture selection.

The requirements workbook remains the source for functional requirements and their IDs. Linear is a delivery tracker; its backlog has not yet been refreshed from the workbook, which is not evidence that existing agreements have changed. Native CLI access is working and verified against workspace `mlai-aus`; see [Linear setup](linear.md). Record any discovered requirement conflict explicitly before changing the affected behaviour. Details marked proposed or open in the HLDDs remain proposed or open.

Accounting: [STU-266 — admin panel](https://linear.app/mlai-aus/issue/STU-266/build-the-master-app-admin-panel) covers the auth/backend groundwork for this delivery per Tom; [STU-109 — connect the prototype to a real database](https://linear.app/mlai-aus/issue/STU-109/connect-the-prototype-to-a-real-database) covers the app connection. A working auth slice does not complete either ticket's full scope.

This handoff records the current delivery direction and supersedes older statements about the infrastructure repository, absence of staging and the placeholder service. It does not approve every proposed detail in the HLDDs.

## Confirmed delivery context

- Upstream: [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app). `origin` fetches and pushes there; local `main` tracks `origin/main`.
- Infrastructure lives in this repository under `infra/`, including the vendored Terraform modules under `infra/modules/`. Rodney's handoff is complete, as confirmed by Tom in this thread; do not keep reopening the old workflow shutdown as a prerequisite.
- `main` deploys to `develop`, which is staging. `production` is the production branch; the production domain and environment setup remain unfinished.
- Staging API: <https://app.asgi.pajamaprofits.net>. This is an internal staging domain.
- The deployed application is the real Hono API image. Its only implemented routes are `GET /` and `GET /health`. There is no member API, authentication, admin UI, database integration or migration runner yet.
- Both health routes must remain independent of database availability.

Sources for the handoff: BB thread `thr_h6zenhdtaq` (infrastructure and API deployment) and `thr_2y8ji47b9j` (Rodney complete, upstream confirmed, member API next). Repository and service state above were checked on 20 October 2026; Rodney's completion is reported by Tom.

## Existing decisions to carry forward

- **Platform:** one TypeScript Hono application on Node 24, containerised on ECS Fargate; Aurora PostgreSQL with Drizzle and SQL migrations. No Redis or message queue. See HLDD 01.
- **API surfaces:** `/v1/*` for members, `/admin/*` for staff and `/webhooks/*` for integrations. Shared validated contracts are planned in `packages/contracts`, which has not been created. See HLDDs 01 and 04.
- **Sign-in:** Better Auth, invite/member-gated magic links plus email codes for members, staff roles and cookie sessions for admin, bearer sessions for the native app. SES sends email; sign-out revokes sessions. A 90-day session duration is still a proposal. See HLDD 01, ACC-01 and ACC-06.
- **Identity:** Maxio decides membership, HubSpot provides identity facts, and our application owns login-to-member links. Ambiguous matches never merge automatically. Human assertions are append-only and take precedence. See HLDD 02, D-14 and CON-16.
- **Access:** capabilities and data-supplied labels rather than client-side tier logic; a pure deterministic resolver, versioned rules with preview, expiring corrections and safeguards that retain last-known-good access. See HLDD 02, D-01 and CON-01/04/05/15–22.
- **Writes:** store member changes and any outbound work in a database transaction; idempotency and a Postgres outbox with retry. Screens do not wait for third-party delivery. See HLDD 01, CON-07 and CON-08.
- **Phase 1:** invitations and auth, staff admin, roster and access resolution, onboarding/profile, seeded catalogue with signed Mux playback and progress, Intercom support, enquiries in our DB and a CX inbox, and health gauges. See D-26 in the HLDD index.
- **Phase 1.5:** HubSpot writes, bulk identity review, no-HubSpot report, catalogue editing/chapters, events, AaronAI, offboarding, push and client read access. Keep these out of the first member API delivery.
- **Acceptance:** the client's conformance suite remains the access acceptance test; restore rehearsal is required before the first member invite. Neither is completed merely by having healthy infrastructure. See HLDD 02, D-01 and ENT-09.

## Next delivery target

The [Better Auth delivery plan](auth-delivery.md) sets out the proposed prerequisites, implementation sequence and observable outcomes for STU-266 and STU-109. It elaborates this baseline; proposed implementation details are not additional product agreements.

The first slice proposed in this thread is database migrations, staff sign-in, an invited test member signing in and an authenticated `GET /v1/me`. Tom has confirmed that the member API is next; the detailed contract and implementation checks below still need to be written against the existing design.

Before implementation, specify the member/auth schema and login linkage, invite lifecycle, `/v1/me` request/response and error contract, staff authorisation, email delivery and migration execution. Keep the contract consistent with HLDD 02's profile, state, plan label, capabilities and access provenance, and HLDD 04's ETag expectation. A test fixture must not be presented as a working Maxio sync or validated access resolver.

The slice is demonstrable when:

- A clean local Postgres can be migrated using the checked-in migrations.
- An authorised staff account can sign in; unauthorised accounts cannot enter `/admin`.
- An eligible test member can sign in through the intended auth flow; an uninvited, unknown email cannot gain member access.
- `/v1/me` identifies the authenticated member without accepting a caller-selected member ID, and rejects unauthenticated requests.
- Sign-out revokes the session; subsequent use of it is rejected.
- `/` and `/health` still return successfully when the database is unavailable.
- Auth and authorisation behaviour has automated coverage, and lint, typecheck, tests and the API container build pass.

This is the first delivery target, not completion of Phase 1. Keep the existing restore-before-invite condition explicit in the test/invitation plan. Implementation and local verification can proceed before a deployment; deployments and infrastructure applies require the user's instruction under AGENTS.md.

## Open details and dependencies

Resolve these where they affect implementation; do not reopen the platform choices above:

- Migration execution, database credentials/connectivity validation and the restore rehearsal. The current health-only API has not demonstrated application database access.
- SES sender, delivery permissions and bounce handling; auth secrets, trusted origins/app links, staff bootstrap and session/token lifetimes.
- Maxio in-scope products and fields, HubSpot access inputs (DEP-27), the read-only Maxio key/webhooks (DEP-26), identity seed data and partner seats (D-30).
- The client's pinned conformance suite and format (D-31), plus final safeguard thresholds and settle window (D-37).
- Existing unresolved HLDD decisions, including correction ownership (D-36). Do not silently promote proposals into requirements.

When a decision changes, update its source HLDD and this handoff with the date, reason and affected requirement IDs. Add the corresponding Linear work when connected; a spreadsheet sync should identify changes against this baseline rather than replace it without explanation.
