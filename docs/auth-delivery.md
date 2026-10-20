# Better Auth and member API delivery plan

Status: proposed implementation plan, 20 October 2026. Builds on the [agreed member API handoff](member-api.md); platform and product decisions there carry forward.

Accounting: [STU-266](https://linear.app/mlai-aus/issue/STU-266/build-the-master-app-admin-panel) for auth/backend/admin groundwork; [STU-109](https://linear.app/mlai-aus/issue/STU-109/connect-the-prototype-to-a-real-database) for app integration. Both are in `[Studio] Master App` in workspace `mlai-aus`, verified with the native CLI. These are umbrella tickets; this first delivery does not close their full scopes.

## Intended result

A named staff user can sign into `/admin`. An eligible test member can receive a sign-in email, authenticate by magic link or email code, reopen the native app with their session intact, read their own persisted profile through `/v1/me`, save onboarding to their account and sign out with session revocation and local data cleared. Another account cannot read that member's data or access staff operations.

The initial access response uses an explicit unconfigured state (`none`, displayed as "access being set up") until the real resolver is available. Do not invent active capabilities or call seeded test data a working Maxio/HubSpot integration. Authentication is not entitlement resolution.

## Prerequisites and when they matter

### Available now

- Hono/Node 24 service, API container build and CI, provisioned Aurora and ECS, HTTPS staging host, `main` → staging deployment pipeline.
- Existing design decisions in HLDDs 01–04. Better Auth, Drizzle, SES, staff cookies and native bearer sessions are selected already.
- Expo SDK 57 app, scheme `mlaisansoni`, iOS/Android application ID `com.sansoni.member`, and SecureStore/TanStack Query dependencies.
- Verified Linear access. No spreadsheet refresh is required to begin the agreed foundation; resolve any later discovered requirement conflict explicitly.

### For implementation and local proof

- Local PostgreSQL matching the deployed major version, a disposable test database and an isolated email capture transport. These can be added as part of implementation; they do not require client credentials.
- A named initial staff identity and a synthetic member fixture, with explicit auth-user-to-member linkage. Define a controlled bootstrap command; no public registration or client-assigned staff roles.
- Specify invite creation/expiry/revocation/acceptance and the shared `/v1/me` and onboarding schemas. Proposed auth mount: `/v1/auth/*`, configured consistently on server and clients.
- Finalise session duration/renewal, code/link expiry, resend and attempt limits. The earlier 90-day session is a proposal, not a newly approved requirement. Document selected values and test them.
- Pin compatible Better Auth, Drizzle adapter and client versions when implementing. Prove the agreed bearer transport across both passwordless flows before broader mobile wiring; the Expo integration's documented cookie default must not silently replace it.

### Before staging verification and the first invitation

- Validate database settings, TLS trust and network access from ECS; health-only routes have not exercised this. Use existing Sansoni resources rather than repeating Rodney's handoff.
- Provide an environment-specific Better Auth secret, canonical auth URL, exact trusted origins, sender address and bootstrap identities. Extend the deployment's current database-only environment allow-list to deliver required auth/mail settings from Secrets Manager; no secrets in source or the mobile bundle.
- Verify SES sender/domain and sending permissions, sandbox/production sending status and allowed test recipients. Implement delivery failure/bounce handling for invite status. Local capture proves flows but not SES delivery.
- Agree the migration execution step: proposed single ECS task from the same image inside the private network, with a migration lock and successful exit required before updating the service. Take the agreed pre-migration snapshot, use additive compatible migrations and retain the previous API image for rollback; rolling back an image does not undo schema changes.
- Rehearse restore from a real backup into an empty database before the first member invite (D-01). Use local captured-mail tests before that gate; do not silently exempt synthetic invitations.
- Confirm universal/app-link association: Apple team ID, app entitlements and Android signing certificate fingerprints. Add association files on the API host and a safe web fallback. Email codes provide a separate path to test sign-in while app-link setup is being completed.

Production domain, production resources and store release remain later rollout work; they do not block local or staging implementation.

## Delivery sequence

### 1. Database, contracts and migration path — STU-266

Add the Postgres client and Drizzle schema/migrations. Generate Better Auth's schema using the selected configuration/plugins, then review and commit SQL with the domain tables: members, auth-member linkage, invites, staff audit, onboarding, outbound mail and rate-limit storage. Create `packages/contracts` and add it to root workspaces and the container's workspace manifest copies. Avoid importing server/auth internals into the mobile bundle.

**Proof:** a clean database migrates successfully; a repeat run is safe; schema constraints prevent duplicate/ambiguous login links. CI integration tests run against real PostgreSQL, not an in-memory substitute.

### 2. Passwordless auth and staff boundary — STU-266

Mount Better Auth in Hono with the Drizzle adapter, magic-link, email-OTP, bearer and scoped staff-role support. Provision eligible auth accounts through the controlled invite/bootstrap path and disable automatic public sign-up in both passwordless plugins. Enforce eligibility before sending and before session issuance, including the library's direct endpoints; a revoked invite cannot be bypassed by a previously issued credential. Existing eligible members retain their returning-login path.

Retain native bearer sessions in SecureStore and secure same-origin cookies for staff. Enforce staff permissions and CSRF protection server-side; audit staff mutations. Use database-backed rate limits across ECS tasks, with proxy-aware client IP handling. Use generic responses for unknown emails, bounded token attempts, hashed verification credentials where supported and logs that exclude codes, links, tokens and member data. Check sessions against server state so revocation is effective.

**Proof:** staff can sign in; members cannot access admin; unknown/revoked accounts cannot gain sessions; expired, wrong and replayed credentials fail; both sign-in paths produce usable sessions; sign-out makes the old session unusable.

### 3. Member endpoints, invitations and real email — STU-266

Implement session-to-member middleware, `GET /v1/me` with member-specific ETag handling and private cache policy, and validated/idempotent `PUT /v1/me/onboarding`. Return a documented error when a session has no member link; a staff session alone is not a member identity. Never accept a caller-supplied member ID as authorisation.

Provide a minimal staff invitation flow with status/resend/revoke and audit, using explicitly linked test records until the Maxio roster is implemented. Persist outbound email work transactionally and deliver through the Postgres outbox/SES transport. Handle retries, expiry and delivery failures without logging credentials or repeatedly sending expired sign-in links. This is a limited admin slice, not completion of STU-266's roster, rules or corrections pages.

**Proof:** each member reads/writes only their own record, onboarding survives a new session/device, retries do not duplicate writes or invites, and delivery failures surface accurately. `/` and `/health` continue to work during database outages.

### 4. Connect the first native session — STU-109

Add the Better Auth client and a shared validated API client using the existing Expo SDK. Wire email code and magic-link callbacks, session hydration before navigation, `/v1/me`, onboarding and sign-out. Use environment-specific API URLs, SecureStore for credentials and TanStack Query for member data. Namespace cached data by member and clear it on sign-out; do not substitute a generic refresh-token scheme for Better Auth's session lifecycle.

Verify loading, empty, error and content behaviour, retain last-known-good member data on network failure, and preserve onboarding drafts on failed saves. Code entry, app restarts, expiry and link callbacks must all be exercised on device. Subsequent screens connect feature by feature after their server endpoints exist.

**Proof:** sign in → reopen app → read persisted profile → save onboarding → sign out → old session rejected; a second account sees none of the first account's cached data. Existing supported prototype flows keep their behaviour.

### 5. Staging release evidence — STU-266 and STU-109

Run lint, typecheck, unit/integration tests and the API container build. Prepare the exact environment/migration changes and rollback instructions for review. Following the user's deployment instruction, run the pre-migration snapshot and migration task, deploy to `develop`, and demonstrate real SES sign-in, member API access and app sign-out against `https://app.asgi.pajamaprofits.net`. Check cookie/role boundaries and ensure logging contains no auth secrets.

**Proof:** record the deployed revision, migration result and completed smoke checks. Infrastructure health alone is insufficient evidence for auth or database readiness. The existing AGENTS.md deployment/apply instruction still applies.

## Later Phase 1 work

Maxio/HubSpot credentials and agreed input fields, identity seed data and the pinned client conformance suite are prerequisites for truthful roster/access delivery. They do not block local auth and member persistence. Finish roster sync, the deterministic resolver, input checks, removal brake, rules preview and corrections before declaring access complete. Catalogue/Mux, progress, support, enquiries and health gauges follow the existing build order. The static-code store-reviewer account is a separate bounded release task, not a general auth bypass in this slice.

## Implementation references checked

Checked 20 October 2026; recheck against the pinned version during implementation:

- [Hono handler, session middleware and CORS](https://better-auth.com/docs/integrations/hono)
- [Drizzle adapter and generated schema/migrations](https://better-auth.com/docs/adapters/drizzle)
- [Magic links and automatic sign-up controls](https://better-auth.com/docs/plugins/magic-link)
- [Email OTP and automatic sign-up controls](https://better-auth.com/docs/plugins/email-otp)
- [Bearer session transport](https://better-auth.com/docs/plugins/bearer)
- [Database-backed rate limits and proxy handling](https://better-auth.com/docs/concepts/rate-limit)
- [Expo integration and its cookie-based default](https://better-auth.com/docs/integrations/expo)
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
