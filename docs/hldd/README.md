# High-level design

Four short design docs, one per layer. Each covers the functional, non-functional and technical shape of its area, traced back to the V1 requirements workbook (requirement IDs like `ENT-02`, decisions `D-01`, design constraints `CON-01`).

**Current delivery handoff (20 October 2026):** [Member API](../member-api.md). Tom confirmed the infrastructure handoff is complete and the member API is next. That page records the current environment, existing decisions, first delivery target and open dependencies. Read it before starting a new implementation plan; older deployment and no-staging assumptions are superseded there.

| Doc | Covers | Status |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [01 — Platform, API and admin](01-platform-api-admin.md)      | AWS hosting, the single API, data store, member and staff auth, email, `/admin`, jobs, observability, client read access                          | Draft v5 |
| [02 — Entitlements and identity](02-entitlements-identity.md) | Sources of truth, linking a person across Maxio and HubSpot, resolving access, freshness, rules and corrections, failure containment, conformance | Draft v2 |
| [03 — Integrations](03-integrations.md) | HubSpot, Maxio, Intercom, Mux and the content catalogue, events calendars, AaronAI, engagement data | Draft v2 |
| [04 — Member app](04-member-app.md) | The Expo app: rebuild approach, API client and auth, caching and offline, push, links, video, support, release | Draft v2 |

Read in order: each builds on the one before.

## Conventions

- Requirements are functional outcomes and live in the workbook. These docs say how we meet them.
- Constraints (`CON-xx`) are properties the design must satisfy and be tested against.
- Each doc ends with the decisions it made and the ones still open. Keep both current.
- Aim for two pages per doc. Detail that only matters to one module goes in that module's own doc (see `../offboarding.md`, `../aaronai-ui.md`).

## Decided (3 Oct 2026)

- **Hosting:** AWS, in the client's own account (D-27); a single production deployment with backups. Region assumed `ap-southeast-2` pending a residency confirmation.
- **API:** one Hono app in a container on ECS Fargate (changed from Lambda on 8 Oct), RDS Postgres, Better Auth, `/admin` server-rendered on the same API, Terraform, monorepo (01). No Redis and no message queue.
- **Access:** agreed with Mark 5 Oct (D-01, five conditions). Maxio says who is a member, HubSpot who they are; login ↔ member links are ours, stored as assertions; ambiguous matches never auto-merge. Versioned rules with preview-before-save, expiring corrections, resolve-time checks and a removal brake; the client's conformance suite runs in our CI (02).
- **Integrations:** two app-owned HubSpot contact properties; enquiries as HubSpot form submissions; Intercom native SDK; catalogue in our DB with signed Mux playback; one calendar feed per membership; AaronAI proxied through our API (03).
- **App:** modules rebuilt against the API; persisted per-member cache; out-of-scope prototype features deleted in sprint 1 (04).

## Phases (D-26, ruled 5 Oct)

**Phase 1 — one member, one honest session.** The complete platform underneath: hosting with a rehearsed restore; invites, passwordless sign-in and emails; `/admin` with the Maxio roster, invites, manual linking, access rules with preview, corrections and health gauges; access resolved from Maxio and HubSpot, passing the client's conformance suite and failure-containment scenarios; "access being set up" and account messages; onboarding, Home and Profile; library with playback, captions and progress; support through Intercom; enquiries to our DB and a CX inbox; TestFlight and store release.

**Phase 1.5 — the rest of V1.** HubSpot writes, bulk identity review, no-HubSpot report, catalogue editing and chapters, events, AaronAI, offboarding, push, client read access.

Build order inside Phase 1:

1. AWS foundation, backups and the restore rehearsal; API skeleton, auth, emails, `/admin` staff sign-in (01).
2. Maxio roster and identity seeding (refs + Mark's 7 merges); resolver, input checks, brake, rules with preview, corrections; conformance suite green in CI (02).
3. App: API client, sign-in, onboarding, Home and Profile on real data (04).
4. Catalogue import, signed Mux playback, captions, progress (03, 04).
5. Intercom, enquiries, health gauges (01, 03, 04).
6. Store builds, reviewer account, synthetic test members, TestFlight to cohort one (01, 04).
