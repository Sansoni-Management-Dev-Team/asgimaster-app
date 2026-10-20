# HLDD 01 — Platform, API and admin

Status: **Draft v5** · Owner: Tom · Updated: 20 Oct 2026

**Changes in v5.** Infrastructure now lives in this repository under `infra/`, including the Terraform modules. Rodney's handoff is complete, as confirmed by Tom. `develop` is staging, deployed from `main`; the real Hono image is running, with health routes only. The member API is the next delivery. See the [implementation handoff](../member-api.md) for the current baseline and open implementation details. The API deploy continues to follow Sansoni's empireone pattern with their shared actions. There is no Redis and no message queue.

## 1. Purpose and scope

The server side of the member app. One TypeScript API in the client's AWS account, used by the app and by the internal `/admin` web backend. It owns member accounts, sign-in, invites, member data (onboarding answers, progress, enquiries), outbound writes, scheduled jobs, inbound webhooks, and read access for the client's own ops tooling.

Not covered here: how access is resolved (02), the specifics of each third-party integration (03), the app (04).

## 2. Requirements covered

| Area                                    | IDs                                                    |
| --------------------------------------- | ------------------------------------------------------ |
| Hosting and rollout                     | PLT-05, PLT-06                                         |
| Access and sign-in                      | ACC-01, ACC-02, ACC-03, ACC-05, ACC-06                 |
| Admin                                   | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-09         |
| Member data                             | ONB-03, PRO-01, PRO-02, PRO-03, PRO-04, ENQ-01, ENQ-03 |
| Push delivery                           | NOT-01                                                 |
| Client data                             | DAT-02                                                 |
| Compliance                              | CMP-02 (reviewer account), CMP-04                      |
| Restore rehearsal, test members, gauges | PLT-07, PLT-08, PLT-09                                 |

**Phase 1:** hosting and the restore rehearsal, API, auth, email, `/admin` (roster, invites, staff sign-in, manual link / unlink, access rules, corrections, enquiries, health), progress and enquiries in our DB, Maxio sync. **Phase 1.5:** HubSpot writes, push, client read access (DAT-02), bulk identity review, no-HubSpot report.

## 3. Architecture

The diagram and the full AWS resource list are in [`../architecture.md`](../architecture.md).

One Hono API runs as a container on ECS Fargate behind an application load balancer. It serves the member API on `/v1/*`, the staff admin on `/admin/*` and inbound webhooks on `/webhooks/*`. It stores everything in RDS PostgreSQL. Scheduled jobs run as separate ECS tasks from the same image.

## 4. Components

**Hosting.** Sansoni's AWS account `806968064090`, `ap-southeast-2` (Sydney). The provisioned `develop` environment is staging, deployed from `main` at `https://app.asgi.pajamaprofits.net`. The `production` branch targets production; that environment and its domain are not set up yet. The planned local development setup is Postgres in Docker, the Hono dev server and an Expo dev client, against third-party sandboxes where they exist. Production rollout remains to be agreed.

**Compute.** One Hono codebase in `apps/api`, built into one container image and stored in ECR. The image runs in two ways:

- `asgi-app-develop`: an ECS Fargate service behind an application load balancer. It also runs the outbox poller (see Outbound writes).
- `jobs`: EventBridge Scheduler starts a one-off ECS task from the same image with a job command.

The load balancer can stream responses, so AaronAI replies need no special route (see 03).

**Networking.** The load balancer runs in public subnets and the ECS tasks run in private subnets. Outbound calls to HubSpot, Intercom, Mux, Expo and AaronAI go through a NAT gateway. Security groups only let traffic reach the tasks from the load balancer. Aurora is in database subnets and only accepts connections from the tasks.

**Database.** Aurora Serverless v2, PostgreSQL 18.6, database `asgi`, encrypted with KMS and deletion protection on. Capacity scales from 0 to 2 units. Drizzle and SQL migrations are planned. There are no migrations or migration steps in the deploy workflow yet. Agree how migrations run with Rodney when database code is added.

Core tables (entitlement tables are defined in 02):

| Table                                      | Holds                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `members`                                  | Our member ID (the key everywhere), name, status                                                                |
| `member_identities`, `identity_assertions` | Emails and upstream IDs (HubSpot contact, Maxio customer); derived links, and append-only human assertions (02) |
| `invites`                                  | Invite status, sent / accepted timestamps, delivery failures. The roster itself is derived from Maxio (02)      |
| Better Auth tables                         | Users, sessions, verification tokens, staff roles                                                               |
| `onboarding_answers`                       | Seven answers + invitation name, versioned                                                                      |
| `progress`                                 | Member × video: furthest position, last watched, first completed at (≥ 90%)                                     |
| `enquiries`                                | Type, payload, idempotency key, HubSpot object ID, status                                                       |
| `push_tokens`                              | Expo push tokens per member device                                                                              |
| `outbox`                                   | Outbound write: target, payload, idempotency key, attempts, status                                              |
| `audit_log`                                | Every staff action: actor, time, target, before / after, reason                                                 |

**Auth (Better Auth).** One instance for members and staff, on our Postgres.

- Members: magic link plus email one-time code (links break in some mail apps). A hook rejects any email without an active invite or member record (ACC-01). The app holds a bearer session token in SecureStore; rolling session, long-lived (proposed 90 days); sign-out revokes it (ACC-06).
- Staff: admin plugin roles (`admin`, `staff`), email code sign-in, cookie session on `/admin`, staff list maintained by MLAI / client admin.
- Store reviewer: one permanent, fully entitled demo member with a static code, no email needed (PLT-03, CMP-02).
- Rate limits on sign-in endpoints (Better Auth built-in).

**Email.** Amazon SES in the client's account: verified client domain (SPF, DKIM, DMARC), production access requested early, templates for invite and sign-in. Bounces and complaints via SNS mark the invite as failed in `/admin`.

**`/admin`.** Server-rendered Hono JSX + htmx in the same API service. Staff role required, CSRF protection, every mutation written to `audit_log`.

| Page              | Does                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Roster            | Live view of in-scope Maxio members with HubSpot refs; select and invite; resend; pending / accepted / failed. CSV only to seed refs and merges |
| Members           | Search; detail shows identities, resolved access and its source, invites, recent activity, enquiries                                            |
| Identity          | Link / unlink records by hand, stored as assertions (ADM-04). Bulk review in Phase 1.5 (ADM-10)                                                 |
| Access rules      | Versioned rules; who / when / why, and a preview of members affected before saving (ADM-09) — the substitute for staging                        |
| Corrections       | Per member; mandatory reason and expiry (default 90 days); append-only; expiring-soon list (ENT-06; who builds it is D-36)                      |
| Enquiries         | Phase 1 enquiries, each also emailed to a CX inbox (ENQ-04)                                                                                     |
| Health            | Canary pull, oldest-payload age, held resolve runs (PLT-09)                                                                                     |
| No HubSpot record | Standing report (ADM-11, Phase 1.5)                                                                                                             |
| Delivery          | Failed outbound writes from the outbox, with retry                                                                                              |
| Audit             | Staff action log                                                                                                                                |

**Outbound writes (CON-07, CON-08).** The API writes the member-facing record and an `outbox` row in one transaction. A poller in the API process claims due rows with `SELECT ... FOR UPDATE SKIP LOCKED`, so two tasks never send the same row. It delivers with the row's idempotency key, retries with backoff, and marks the row failed after a fixed number of attempts. Failures surface on the Delivery page. There is no message queue, as the CTO asked. Screens never wait on a third party.

**Jobs.** EventBridge Scheduler starts the `jobs` ECS task: nightly member activity to HubSpot (DAT-01), access refresh (02), push receipt checks and invalid-token pruning, expired-token cleanup.

**Push.** The app registers Expo push tokens; the outbox poller sends via `expo-server-sdk`. Payloads carry no member data (title, short body, deep link only).

**Client read access (D-05).** A read-only Postgres role with `SELECT` on documented `ops.*` views (members, identities, access, progress, enquiries) — views, not raw tables, so internals can change. Schema doc generated from Drizzle into `docs/`. Connection path still open (see §8).

**Secrets.** The deploy workflow reads database settings from Sansoni's `asgi-secrets-develop` and writes `PORT` and existing database keys to an S3 environment file that ECS loads at startup. The API currently reads only `PORT`; validate the required settings and connectivity when implementing database access rather than treating the health check as evidence of it. Rodney's infrastructure handoff is complete per Tom. The environment file uses the provisioned `asgi-main-develop` bucket. The execution role can read it. Third-party credential delivery to Sansoni DevOps remains to be agreed. Nothing third-party belongs in the app (CON-03).

**Observability (CON-10).** Structured JSON logs to CloudWatch (14 days of log retention), Sentry for API and app errors with PII scrubbing, CloudWatch alarms on failed outbox rows, 5xx rate, ECS task restarts and RDS storage / CPU, emailed to MLAI and the client. Separately, data-health gauges (CON-23, PLT-09): a synthetic access pull on a test member, the age of the oldest payload, and held resolve runs — shown in `/admin` and emailed. A brake trip is the system working, so it never reaches crash reporting.

**Domains.** `app.asgi.pajamaprofits.net` with an ACM certificate. `/admin` will use the same host. The API will also serve the iOS and Android app-link files so magic links open the app.

**IaC and CI/CD.** AWS resources are defined with Terragrunt in `infra/`, which was copied from Sansoni's `devops-infrastructure-asgi-app` repository on 18 Oct. Sansoni DevOps maintains it. Pull requests that change `infra/` run a Terragrunt plan. Pushes apply it, with `main` going to `develop` (staging) and `production` going to production. CI in `.github/workflows/ci.yml` runs lint, typecheck, tests and an API image build on pushes and pull requests. The deploy workflow in `.github/workflows/main.yml` follows Sansoni's empireone pattern using shared actions from `devops-github-workflows`. Only pushes to `main` that change API files or the listed build and deploy inputs can trigger it. It assumes `github-role` through OIDC, uploads the environment file to S3, builds and pushes the API image, fills the placeholders in `taskdef.json`, registers the task definition and updates the ECS service. There are no migrations yet. The execution role can read the environment file from `asgi-main-develop`. The workflow waits until the new tasks are healthy. The API answers `/` for the existing target group health check and `/health` for the container health check without calling the database. The client's conformance suite (ENT-09) and the whole-base access diff for resolver changes (CON-25, proposed) remain planned checks.

**Repo.** npm workspaces monorepo at [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app). `apps/mobile` holds the Expo app and `apps/api` holds the API. `infra` holds the Terragrunt for the AWS resources. `packages/contracts` (shared zod schemas and types for API requests and responses) is planned but not created yet.

## 5. Key flows

1. **Invite.** Staff pick members from the Maxio-derived roster → invites created → SES sends link + code → status tracked in `/admin`.
2. **First sign-in.** Member taps the link (opens the app) or types the code → Better Auth verifies → invite gate passes → session token → app calls `/v1/me` for profile and access (02).
3. **Returning.** Session continues; expired → sign in again; sign-out revokes.
4. **Member write.** App sends progress or an enquiry with an idempotency key → API stores it (and an outbox row if it goes upstream) → responds immediately → the outbox poller delivers.
5. **Nightly.** `jobs` aggregates activity → outbox → HubSpot.
6. **Staff change.** Identity fix or access correction in `/admin` → written with reason to `audit_log`.

## 6. Non-functional requirements

- **Scale.** 341 members at launch, weekly cohorts; low traffic. One small Fargate task and a small RDS instance are ample.
- **Availability.** Single region, Aurora database with one instance. The app tolerates API outages by showing its last good data (CON-01, 04).
- **Backups.** RDS automated backups with point-in-time recovery (proposed 14-day retention; Sansoni's infrastructure sets 7 for now), manual snapshot before every migration, and a restore rehearsed from a real production backup into an empty database before the first invite (PLT-07).
- **Security.** TLS everywhere; DB private; least-privilege IAM per function; secrets in Secrets Manager; staff actions audited; sign-in rate-limited.
- **Residency.** Member data at rest stays in `ap-southeast-2`. Data that leaves: Expo push (content-free payloads), Sentry (scrubbed errors), the client's existing vendors (HubSpot, Intercom), AaronAI inference (03). State this in the privacy policy.
- **Cost.** Reassess launch costs for Sansoni's Aurora, load balancer, Fargate, NAT gateway, SES and CloudWatch configuration before launch.

## 7. Constraints

| Constraint                                 | How it's met                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| CON-03 app talks only to our API           | All third-party calls and secrets live in the API                                            |
| CON-07 writes never block a screen         | Outbox table + poller in the API                                                             |
| CON-08 every write safe to retry           | Idempotency key per write; unique constraints; upstream idempotency where supported          |
| CON-09 separate environments               | `main` deploys to provisioned `develop` (staging); `production` targets production, still to be set up. |
| CON-10 error reporting and logs            | Sentry + CloudWatch + alarms                                                                 |
| CON-14 backups                             | Point-in-time recovery, snapshot before every migration, restore rehearsed before cohort one |
| CON-23 gauges                              | Canary pull, oldest-payload age, held runs                                                   |
| CON-13 room for bookings / Project Acquire | Member-keyed tables; bookings would be their own object table, not counters                  |

## 8. Decisions

**Agreed with Mark (5 Oct 2026)**

- `/admin` (D-03), the D-01 conditions and the Phase 1 slice (D-26). The original no-staging assumption was superseded by the environment agreement below; preview-before-save remains required.

**Current baseline (20 Oct 2026, Tom; infrastructure work on 18 Oct)**

- Infrastructure and vendored modules live under `infra/` in this repository. Rodney's handoff is complete.
- `main` deploys to `develop` (staging); `production` is the production branch.
- The health-only API is deployed. The member API is next; see the [implementation handoff](../member-api.md).

**Agreed with Sansoni (14 Oct 2026)**

Historical agreement: Sansoni DevOps owned AWS resources in `devops-infrastructure-asgi-app`, with CI/CD following their shared actions and empireone pattern. Infrastructure location was superseded by the current baseline above; the shared-action deployment pattern remains.

**Made with Sansoni's CTO (8 Oct 2026)**

- Containerised deployment on ECS Fargate, replacing Lambda.
- No Redis and no message queue. The outbox poller replaces SQS and the worker Lambda.
- Terraform for every resource. Ownership moved to Sansoni DevOps on 14 Oct.
- RDS PostgreSQL kept as small as possible. PostgreSQL 18.
- The repository is now in Sansoni's GitHub. Tom and Sam have admin access until handover.

**Made (3 Oct 2026)**

- AWS, client's account (D-27); single production deployment with backups.
- Hono; RDS PostgreSQL; Drizzle. (Lambda replaced on 8 Oct.)
- Better Auth, magic link + email code for members, admin roles for staff (D-15).
- `/admin` server-rendered in Hono (JSX + htmx) on the same API (D-03, to confirm with Mark).
- SES for email (D-28); Expo Push Service.
- Terraform, now owned by Sansoni DevOps, and an app monorepo in `asgimaster-app`.

**Open**

- D-05 — how the client's tooling connects to the read-only role: SSM port-forward through a small bastion, or an IP-allowlisted read replica.
- Residency approval for the provisioned `ap-southeast-2` region remains to be confirmed with the client.
- Aurora has one instance. Agree production availability and recovery needs with Sansoni DevOps.
- Backup retention — 14 days proposed.
- Test-member isolation — proposed (D-34): test members are synthetic people with no HubSpot ID, every HubSpot write is keyed on a linked contact ID (CON-24), and one CX-owned real test contact exercises the write path. A staging environment now exists; these proposed isolation rules still need confirmation.
- D-19 — account deletion route.

## 9. Risks

- **Deploy readiness.** Only `develop` is provisioned. The existing target group checks `/`, which the API answers without a database call. Production rollout and rollback remain to be agreed.
- **Email readiness.** SES domain verification exists, but the task role still needs send permission and bounce handling resources are not built.
- **Database pausing.** Aurora can pause at 0 capacity. Confirm whether that suits the API and its planned outbox poller with Sansoni DevOps.

## 10. Out of scope

Staff features inside the member app (ADM-06); the client's own ops console (ADM-07); per-PR preview environments (possible later with Sansoni DevOps).
