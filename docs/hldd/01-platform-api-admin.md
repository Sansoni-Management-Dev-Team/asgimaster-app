# HLDD 01 — Platform, API and admin

## Scope and selected platform

One server-side application serves the member app and the internal browser admin in the client's AWS account (D-27). The selected design is TypeScript/Hono in an ECS Fargate container, Aurora PostgreSQL with Drizzle and SQL migrations, and server-rendered Hono JSX/htmx admin (D-03). Scheduled work uses the same application image. There is no Redis or message queue. These are settled architecture choices, not a platform selection exercise.

The [staff admin interface specification](../features/staff-admin-ui.md) owns shared presentation, progressive enhancement, navigation, accessibility and form recovery conventions.

Better Auth is selected for member/staff authentication (D-15), SES for email (D-28) and Expo Push Service for member notifications. Native members use bearer sessions; staff use secure browser cookie sessions. Staff roles, CSRF protection and member linkage are enforced server-side. The canonical eligibility/session requirements and restore gate are in [authentication](../features/authentication.md); identity/access policy is in [access and identity](../features/access-identity.md).

The [architecture diagram](../architecture.md) shows trust boundaries. [API source](../../apps/api/), [mobile source](../../apps/mobile/), [infrastructure](../../infra/) and [workflow source](../../.github/workflows/) are authoritative for concrete schemas, routes, configuration and resources. Sansoni DevOps maintains infrastructure; Rodney reviews infrastructure changes. Deployment and infrastructure apply require the user's instruction.

## Durable member work and outbound delivery

Member writes and their outbound work are committed atomically in PostgreSQL. A database outbox poller claims work safely across service instances, retries with backoff and makes exhausted failures visible to staff. Stable idempotency protects repeated requests and third-party retries (CON-07, CON-08). The client receives acknowledgement of durable account storage without waiting for a vendor. Vendor-specific ambiguity and duplicate risks are addressed in [HLDD 03](03-integrations.md).

Background jobs handle source reconciliation, activity aggregation and delivery maintenance. Jobs must be observable and safe to repeat. Integration credentials remain server-side (CON-03); the member app receives only scoped playback/support credentials needed for the selected native experiences.

## Operations and security

Requirements: PLT-05–PLT-09, ADM-05, ADM-07, DAT-02, CMP-04. Constraints: CON-09, CON-10, CON-13, CON-14.

- Member data and database access remain private, encrypted and protected by least privilege. Secrets are delivered outside source and mobile bundles. Credential requests and sessions are subject to the [authentication safeguards](../features/authentication.md).
- Sentry reports app and API errors under the intended staging or production environment. Error reporting and structured operational logs scrub personal data and credentials before transmission, including exception text, request bodies, query strings, credentials in URLs, cookies, authorization headers and sensitive breadcrumbs. Reporting failures must not interrupt member operations or health probes. Technical failures and failed outbound work alert operators. Access data-health monitoring is defined once in [access and identity](../features/access-identity.md#refresh-and-failure-containment).
- Backups support point-in-time recovery. Take a snapshot before each migration and retain a compatible rollback path; reverting an image does not undo a schema change. The [pre-invitation restore gate](../features/authentication.md#invitation-release-gate) is mandatory.
- Health checks must remain independent of database availability; health alone does not prove database, mail or authentication readiness.
- Staging and production are separate environments (CON-09). Workflow definitions and infrastructure configuration determine their deployment mapping; staging does not replace entitlement preview or conformance gates.
- The intended data-residency boundary is Australia, with vendor processing and inference disclosed in privacy terms. Final approval and vendor exceptions remain open below.

## Client read access

D-05 selects read-only access to stable operational views for the client's tooling, rather than coupling it to internal tables. The views cover member operations without granting mutation privileges; their exact schema belongs in implementation-generated references outside this product documentation. They are not a second staff console owned by this app (ADM-07).

## Unresolved technical and operating choices

- D-05: approved private connection path for client tooling; a managed tunnel or allowlisted read replica are options.
- Production availability/recovery objectives, backup retention and database pausing policy need Sansoni DevOps agreement. Do not infer approval from provisioned capacity.
- Residency approval and vendor processing locations/disclosures need client confirmation.
- Migration execution, concurrency protection and rollback procedures must be agreed with Sansoni DevOps before migration-bearing releases.
- Credential delivery, authorised operators and alert recipients need an assigned operational owner. Resource names and credentials belong in environment configuration.
- D-34/CON-24 test-member isolation remains proposed in [access and identity](../features/access-identity.md#unresolved-choices); use of staging does not resolve the HubSpot write questions.

The design leaves room for future member-keyed booking/consumption objects (CON-13) without making them part of the present product. Staff features inside the member app, the client's own operations console and per-PR environments are outside scope.
