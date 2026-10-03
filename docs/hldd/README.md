# High-level design

Four short design docs, one per layer. Each covers the functional, non-functional and technical shape of its area, traced back to the V1 requirements workbook (requirement IDs like `ENT-02`, decisions `D-01`, design constraints `CON-01`).

| Doc | Covers | Status |
| --- | --- | --- |
| [01 — Platform, API and admin](01-platform-api-admin.md) | AWS hosting, the single API, data store, member and staff auth, email, `/admin`, jobs, observability, client read access | Draft v1 |
| [02 — Entitlements and identity](02-entitlements-identity.md) | Linking a person across HubSpot / Maxio / Klaviyo, resolving what they can access, freshness, corrections, failure behaviour | Draft v1 |
| [03 — Integrations](03-integrations.md) | HubSpot, Maxio, Intercom, Mux and the content catalogue, events calendars, AaronAI, engagement data | Draft v1 |
| [04 — Member app](04-member-app.md) | The Expo app: rebuild approach, API client and auth, caching and offline, push, links, video, support, release | Draft v1 |

Read in order: each builds on the one before.

## Conventions

- Requirements are functional outcomes and live in the workbook. These docs say how we meet them.
- Constraints (`CON-xx`) are properties the design must satisfy and be tested against.
- Each doc ends with the decisions it made and the ones still open. Keep both current.
- Aim for two pages per doc. Detail that only matters to one module goes in that module's own doc (see `../offboarding.md`, `../aaronai-ui.md`).

## Decided (3 Oct 2026)

- **Hosting:** AWS, in the client's own account (D-27); a single production deployment with backups. Region assumed `ap-southeast-2` pending a residency confirmation.
- **API:** one Hono app on Lambda, RDS Postgres, Better Auth, `/admin` server-rendered on the same API, Terraform, monorepo (01).
- **Access:** our API links identities (suggested, staff-confirmed) and resolves access from HubSpot + Maxio using rules in `/admin`; Maxio webhooks plus nightly refresh (02). To confirm with Mark.
- **Integrations:** two app-owned HubSpot contact properties; enquiries as HubSpot form submissions; Intercom native SDK; catalogue in our DB with signed Mux playback; one calendar feed per membership; AaronAI proxied through our API (03).
- **App:** modules rebuilt against the API; persisted per-member cache; out-of-scope prototype features deleted in sprint 1 (04).

## Suggested build order

1. API skeleton on AWS: auth, invites, `/admin` cohorts and identity review, `/v1/me` (01, 02). App: API client, sign-in, onboarding and Home on real data (04).
2. Access rules and resolver against real HubSpot / Maxio data; diff against Mark's join tables (02).
3. Catalogue import, signed Mux playback, chapters, progress and the HubSpot activity write (03).
4. Intercom, enquiries via HubSpot forms, offboarding (both paths) (03, 04).
5. Events feeds, AaronAI proxy (03).
6. Push, store builds, TestFlight to the first cohort (01, 04).
