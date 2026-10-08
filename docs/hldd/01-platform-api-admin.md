# HLDD 01 — Platform, API and admin

Status: **Draft v3** (CTO meeting 8 Oct) · Owner: Tom · Updated: 8 Oct 2026

**Changes in v3.** Sansoni's CTO asked for a containerised deployment with no Redis and no message queue, built with Terraform in this monorepo. The API now runs on ECS Fargate instead of Lambda. Outbound writes are delivered by a poller in the API instead of SQS and a worker Lambda. Scheduled jobs run as ECS tasks. The NAT instance is gone because the tasks run in public subnets.

## 1. Purpose and scope

The server side of the member app. One TypeScript API in the client's AWS account, used by the app and by the internal `/admin` web backend. It owns member accounts, sign-in, invites, member data (onboarding answers, progress, enquiries), outbound writes, scheduled jobs, inbound webhooks, and read access for the client's own ops tooling.

Not covered here: how access is resolved (02), the specifics of each third-party integration (03), the app (04).

## 2. Requirements covered

| Area | IDs |
| --- | --- |
| Hosting and rollout | PLT-05, PLT-06 |
| Access and sign-in | ACC-01, ACC-02, ACC-03, ACC-05, ACC-06 |
| Admin | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-09 |
| Member data | ONB-03, PRO-01, PRO-02, PRO-03, PRO-04, ENQ-01, ENQ-03 |
| Push delivery | NOT-01 |
| Client data | DAT-02 |
| Compliance | CMP-02 (reviewer account), CMP-04 |
| Restore rehearsal, test members, gauges | PLT-07, PLT-08, PLT-09 |

**Phase 1:** hosting and the restore rehearsal, API, auth, email, `/admin` (roster, invites, staff sign-in, manual link / unlink, access rules, corrections, enquiries, health), progress and enquiries in our DB, Maxio sync. **Phase 1.5:** HubSpot writes, push, client read access (DAT-02), bulk identity review, no-HubSpot report.

## 3. Architecture

The diagram and the full AWS resource list are in [`../architecture.md`](../architecture.md).

One Hono API runs as a container on ECS Fargate behind an application load balancer. It serves the member API on `/v1/*`, the staff admin on `/admin/*` and inbound webhooks on `/webhooks/*`. It stores everything in RDS PostgreSQL. Scheduled jobs run as separate ECS tasks from the same image.

## 4. Components

**Hosting.** Client's AWS account, `ap-southeast-2` (Sydney, assumed for AU residency — confirm). A **single production deployment** with backups; no staging or per-PR environments in AWS for V1. Development runs locally (Postgres in Docker, Hono dev server, Expo dev client) against third-party sandboxes where they exist.

**Compute.** One Hono codebase in `apps/api`, built into one container image and stored in ECR. The image runs in two ways:
- `api`: an ECS Fargate service behind an application load balancer. It also runs the outbox poller (see Outbound writes).
- `jobs`: EventBridge Scheduler starts a one-off ECS task from the same image with a job command.

The load balancer can stream responses, so AaronAI replies need no special route (see 03).

**Networking.** The load balancer and the ECS tasks run in public subnets. Each task has a public IP address, so outbound calls (HubSpot, Intercom, Mux, Expo, AaronAI) go straight out through the internet gateway and no NAT is needed. Security groups only let traffic reach the tasks from the load balancer. RDS is in private subnets with no route to the internet and only accepts connections from the tasks.

**Database.** RDS PostgreSQL 18, small Graviton instance, single-AZ to start, encrypted (KMS), deletion protection on. Drizzle for schema and SQL migrations, run as a deploy step.

Core tables (entitlement tables are defined in 02):

| Table | Holds |
| --- | --- |
| `members` | Our member ID (the key everywhere), name, status |
| `member_identities`, `identity_assertions` | Emails and upstream IDs (HubSpot contact, Maxio customer); derived links, and append-only human assertions (02) |
| `invites` | Invite status, sent / accepted timestamps, delivery failures. The roster itself is derived from Maxio (02) |
| Better Auth tables | Users, sessions, verification tokens, staff roles |
| `onboarding_answers` | Seven answers + invitation name, versioned |
| `progress` | Member × video: furthest position, last watched, first completed at (≥ 90%) |
| `enquiries` | Type, payload, idempotency key, HubSpot object ID, status |
| `push_tokens` | Expo push tokens per member device |
| `outbox` | Outbound write: target, payload, idempotency key, attempts, status |
| `audit_log` | Every staff action: actor, time, target, before / after, reason |

**Auth (Better Auth).** One instance for members and staff, on our Postgres.
- Members: magic link plus email one-time code (links break in some mail apps). A hook rejects any email without an active invite or member record (ACC-01). The app holds a bearer session token in SecureStore; rolling session, long-lived (proposed 90 days); sign-out revokes it (ACC-06).
- Staff: admin plugin roles (`admin`, `staff`), email code sign-in, cookie session on `/admin`, staff list maintained by MLAI / client admin.
- Store reviewer: one permanent, fully entitled demo member with a static code, no email needed (PLT-03, CMP-02).
- Rate limits on sign-in endpoints (Better Auth built-in).

**Email.** Amazon SES in the client's account: verified client domain (SPF, DKIM, DMARC), production access requested early, templates for invite and sign-in. Bounces and complaints via SNS mark the invite as failed in `/admin`.

**`/admin`.** Server-rendered Hono JSX + htmx in the same API service. Staff role required, CSRF protection, every mutation written to `audit_log`.

| Page | Does |
| --- | --- |
| Roster | Live view of in-scope Maxio members with HubSpot refs; select and invite; resend; pending / accepted / failed. CSV only to seed refs and merges |
| Members | Search; detail shows identities, resolved access and its source, invites, recent activity, enquiries |
| Identity | Link / unlink records by hand, stored as assertions (ADM-04). Bulk review in Phase 1.5 (ADM-10) |
| Access rules | Versioned rules; who / when / why, and a preview of members affected before saving (ADM-09) — the substitute for staging |
| Corrections | Per member; mandatory reason and expiry (default 90 days); append-only; expiring-soon list (ENT-06; who builds it is D-36) |
| Enquiries | Phase 1 enquiries, each also emailed to a CX inbox (ENQ-04) |
| Health | Canary pull, oldest-payload age, held resolve runs (PLT-09) |
| No HubSpot record | Standing report (ADM-11, Phase 1.5) |
| Delivery | Failed outbound writes from the outbox, with retry |
| Audit | Staff action log |

**Outbound writes (CON-07, CON-08).** The API writes the member-facing record and an `outbox` row in one transaction. A poller in the API process claims due rows with `SELECT ... FOR UPDATE SKIP LOCKED`, so two tasks never send the same row. It delivers with the row's idempotency key, retries with backoff, and marks the row failed after a fixed number of attempts. Failures surface on the Delivery page. There is no message queue, as the CTO asked. Screens never wait on a third party.

**Jobs.** EventBridge Scheduler starts the `jobs` ECS task: nightly member activity to HubSpot (DAT-01), access refresh (02), push receipt checks and invalid-token pruning, expired-token cleanup.

**Push.** The app registers Expo push tokens; the outbox poller sends via `expo-server-sdk`. Payloads carry no member data (title, short body, deep link only).

**Client read access (D-05).** A read-only Postgres role with `SELECT` on documented `ops.*` views (members, identities, access, progress, enquiries) — views, not raw tables, so internals can change. Schema doc generated from Drizzle into `docs/`. Connection path still open (see §8).

**Secrets.** Third-party credentials in SSM Parameter Store SecureString (KMS). RDS manages the database password in Secrets Manager. ECS passes both to the container when it starts. Nothing third-party in the app (CON-03).

**Observability (CON-10).** Structured JSON logs to CloudWatch (30-day retention), Sentry for API and app errors with PII scrubbing, CloudWatch alarms on failed outbox rows, 5xx rate, ECS task restarts and RDS storage / CPU, emailed to MLAI and the client. Separately, data-health gauges (CON-23, PLT-09): a synthetic access pull on a test member, the age of the oldest payload, and held resolve runs — shown in `/admin` and emailed. A brake trip is the system working, so it never reaches crash reporting.

**Domains.** `api.<client-domain>` with ACM certificate; `/admin` on the same host. The API also serves the iOS / Android app-link files so magic links open the app (needs DNS, DEP-25).

**IaC and CI/CD.** Terraform in `infra/`, state in S3 with native lockfile. Today CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, an API image build and `terraform validate`, and the deploy workflow is a stub. The rest of this paragraph is the target. GitHub Actions assumes a deploy role in the client account via OIDC (no long-lived keys). PRs: lint, unit tests, the client's conformance suite (pinned version pulled from their repo, ENT-09), `terraform plan`. A failing conformance scenario blocks deploy. Resolver changes also produce a whole-base access diff against current results for review before deploy (CON-25, proposed). `main`: build → run migrations → deploy, with manual approval on apply.

**Repo.** npm workspaces monorepo in `master-app`, moving to Sansoni's GitHub organisation. `apps/mobile` holds the Expo app, `apps/api` the API and `infra/` the Terraform. `packages/contracts` (shared zod schemas and types for API requests and responses) is planned but not created yet.

## 5. Key flows

1. **Invite.** Staff pick members from the Maxio-derived roster → invites created → SES sends link + code → status tracked in `/admin`.
2. **First sign-in.** Member taps the link (opens the app) or types the code → Better Auth verifies → invite gate passes → session token → app calls `/v1/me` for profile and access (02).
3. **Returning.** Session continues; expired → sign in again; sign-out revokes.
4. **Member write.** App sends progress or an enquiry with an idempotency key → API stores it (and an outbox row if it goes upstream) → responds immediately → the outbox poller delivers.
5. **Nightly.** `jobs` aggregates activity → outbox → HubSpot.
6. **Staff change.** Identity fix or access correction in `/admin` → written with reason to `audit_log`.

## 6. Non-functional requirements

- **Scale.** 341 members at launch, weekly cohorts; low traffic. One small Fargate task and a small RDS instance are ample.
- **Availability.** Single region, single-AZ database. The app tolerates API outages by showing its last good data (CON-01, 04).
- **Backups.** RDS automated backups with point-in-time recovery (proposed 14-day retention; the Terraform sets 7 for now), manual snapshot before every migration, and a restore rehearsed from a real production backup into an empty database before the first invite (PLT-07).
- **Security.** TLS everywhere; DB private; least-privilege IAM per function; secrets in Parameter Store; staff actions audited; sign-in rate-limited.
- **Residency.** Member data at rest stays in `ap-southeast-2`. Data that leaves: Expo push (content-free payloads), Sentry (scrubbed errors), the client's existing vendors (HubSpot, Intercom), AaronAI inference (03). State this in the privacy policy.
- **Cost.** Expected well under A$100/month at launch scale (RDS, load balancer, Fargate, public IPv4 addresses, SES, CloudWatch). Verify with the AWS pricing calculator once the region is confirmed.

## 7. Constraints

| Constraint | How it's met |
| --- | --- |
| CON-03 app talks only to our API | All third-party calls and secrets live in the API |
| CON-07 writes never block a screen | Outbox table + poller in the API |
| CON-08 every write safe to retry | Idempotency key per write; unique constraints; upstream idempotency where supported |
| CON-09 separate environments | **Replaced** by a single production deployment with backups; local dev and third-party sandboxes instead |
| CON-10 error reporting and logs | Sentry + CloudWatch + alarms |
| CON-14 backups | Point-in-time recovery, snapshot before every migration, restore rehearsed before cohort one |
| CON-23 gauges | Canary pull, oldest-payload age, held runs |
| CON-13 room for bookings / Project Acquire | Member-keyed tables; bookings would be their own object table, not counters |

## 8. Decisions

**Agreed with Mark (5 Oct 2026)**
- `/admin` (D-03), the D-01 conditions, the Phase 1 slice (D-26), dropping staging in favour of preview-before-save.

**Made with Sansoni's CTO (8 Oct 2026)**
- Containerised deployment on ECS Fargate, replacing Lambda.
- No Redis and no message queue. The outbox poller replaces SQS and the worker Lambda.
- Terraform for every resource, in this monorepo, with `apps/mobile`, `apps/api` and `infra/`.
- RDS PostgreSQL kept as small as possible. PostgreSQL 18.
- The repository moves to Sansoni's GitHub. Tom and Sam have admin access until handover.

**Made (3 Oct 2026)**
- AWS, client's account (D-27); single production deployment with backups.
- Hono; RDS PostgreSQL; Drizzle. (Lambda replaced on 8 Oct.)
- Better Auth, magic link + email code for members, admin roles for staff (D-15).
- `/admin` server-rendered in Hono (JSX + htmx) on the same API (D-03, to confirm with Mark).
- SES for email (D-28); Expo Push Service.
- Terraform; monorepo in `master-app`.

**Open**
- D-05 — how the client's tooling connects to the read-only role: SSM port-forward through a small bastion, or an IP-allowlisted read replica.
- Region / residency — confirm `ap-southeast-2` with the client.
- RDS Multi-AZ — off by default; turn on if the client wants faster recovery.
- Backup retention — 14 days proposed.
- Testing without staging — proposed (D-34): test members are synthetic people with no HubSpot ID, every HubSpot write is keyed on a linked contact ID (CON-24), and one CX-owned real test contact exercises the write path.
- D-19 — account deletion route.

## 9. Risks

- **No staging.** A bad migration or deploy hits members directly. Mitigated by preview-before-save for rule changes, a whole-base access diff for resolver changes, snapshot-before-migrate, manual approval on deploy, and a rehearsed restore.
- **AWS access lead time.** Nothing deploys until the client grants access (DEP-18) and DNS (DEP-25); SES production access takes a day or so.
- **Tasks in public subnets.** Each task has a public IP address. Security groups only allow traffic from the load balancer, and nothing on the task listens on other ports.

## 10. Out of scope

Staff features inside the member app (ADM-06); the client's own ops console (ADM-07); per-PR preview environments (possible later with Terraform workspaces).
