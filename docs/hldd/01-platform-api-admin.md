# HLDD 01 — Platform, API and admin

Status: **Draft v2** (Mark's 5 Oct notes) · Owner: Tom · Updated: 5 Oct 2026

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

```
Member app (Expo) ─┐                         ┌─ /v1/*        member API
Staff browser ─────┼─ HTTPS ─ API Gateway ── Lambda "api" (Hono) ─┼─ /admin/*     server-rendered admin
Maxio/Intercom/Mux ┘   (HTTP API, custom     │                    └─ /webhooks/*  inbound webhooks
   webhooks             domain)              │
                                             ├─ writes intent ──▶ outbox table + SQS ──▶ Lambda "worker"
                                             │                                            ├─▶ HubSpot / Intercom
                                             │                                            └─▶ Expo Push
EventBridge Scheduler ──────────────────────▶ Lambda "jobs" (same codebase): nightly HubSpot activity, access refresh, cleanup
                                             │
                          RDS PostgreSQL (private subnets, encrypted, PITR backups)
                                             └─ read-only role on ops.* views ──▶ client ops tooling
Also: SES (email) · SSM Parameter Store (secrets) · CloudWatch Logs + alarms · Sentry
Outbound internet from the VPC: NAT instance (fck-nat), not a NAT gateway
```

## 4. Components

**Hosting.** Client's AWS account, `ap-southeast-2` (Sydney, assumed for AU residency — confirm). A **single production deployment** with backups; no staging or per-PR environments in AWS for V1. Development runs locally (Postgres in Docker, Hono dev server, Expo dev client) against third-party sandboxes where they exist.

**Compute.** One Hono codebase in `api/`, deployed as three Lambda functions sharing code: `api` (behind API Gateway HTTP API), `worker` (SQS consumer for outbound writes), `jobs` (EventBridge Scheduler targets). If AaronAI replies need streaming, add a Lambda function URL with response streaming for that route (see 03).

**Networking.** Lambdas run in private subnets to reach RDS. Outbound calls (HubSpot, Intercom, Mux, Expo, AaronAI) go through a NAT instance (fck-nat on a t4g.nano in an auto-recovering ASG) instead of a ~$45/month NAT gateway. S3 via the free gateway endpoint. If the NAT instance is briefly down, outbound writes wait in the queue (CON-07).

**Database.** RDS PostgreSQL, small Graviton instance, single-AZ to start, encrypted (KMS), deletion protection on. Drizzle for schema and SQL migrations, run as a deploy step.

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

**`/admin`.** Server-rendered Hono JSX + htmx on the same Lambda. Staff role required, CSRF protection, every mutation written to `audit_log`.

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

**Outbound writes (CON-07, CON-08).** The API writes the member-facing record and an `outbox` row in one transaction, then enqueues to SQS. `worker` delivers with the row's idempotency key, retries with backoff, and moves to a DLQ after a fixed number of attempts; failures surface on the Delivery page. Screens never wait on a third party.

**Jobs.** EventBridge Scheduler → `jobs`: nightly member activity to HubSpot (DAT-01), access refresh (02), push receipt checks and invalid-token pruning, expired-token cleanup.

**Push.** The app registers Expo push tokens; `worker` sends via `expo-server-sdk`. Payloads carry no member data (title, short body, deep link only).

**Client read access (D-05).** A read-only Postgres role with `SELECT` on documented `ops.*` views (members, identities, access, progress, enquiries) — views, not raw tables, so internals can change. Schema doc generated from Drizzle into `docs/`. Connection path still open (see §8).

**Secrets.** SSM Parameter Store SecureString (KMS). Nothing third-party in the app (CON-03).

**Observability (CON-10).** Structured JSON logs to CloudWatch (30-day retention), Sentry for API and app errors with PII scrubbing, CloudWatch alarms on DLQ depth, 5xx rate, Lambda errors and RDS storage / CPU, emailed to MLAI and the client. Separately, data-health gauges (CON-23, PLT-09): a synthetic access pull on a test member, the age of the oldest payload, and held resolve runs — shown in `/admin` and emailed. A brake trip is the system working, so it never reaches crash reporting.

**Domains.** `api.<client-domain>` with ACM certificate; `/admin` on the same host. The API also serves the iOS / Android app-link files so magic links open the app (needs DNS, DEP-25).

**IaC and CI/CD.** Terraform in `infra/`, state in S3 with native lockfile. GitHub Actions assumes a deploy role in the client account via OIDC (no long-lived keys). PRs: lint, unit tests, the client's conformance suite (pinned version pulled from their repo, ENT-09), `terraform plan`. A failing conformance scenario blocks deploy. Resolver changes also produce a whole-base access diff against current results for review before deploy (CON-25, proposed). `main`: build → run migrations → deploy, with manual approval on apply.

**Repo.** Monorepo in `master-app`: the Expo app stays at the root for now; `api/`, `infra/` and `packages/contracts` (shared zod schemas and types for API requests and responses) as npm workspaces.

## 5. Key flows

1. **Invite.** Staff pick members from the Maxio-derived roster → invites created → SES sends link + code → status tracked in `/admin`.
2. **First sign-in.** Member taps the link (opens the app) or types the code → Better Auth verifies → invite gate passes → session token → app calls `/v1/me` for profile and access (02).
3. **Returning.** Session continues; expired → sign in again; sign-out revokes.
4. **Member write.** App sends progress or an enquiry with an idempotency key → API stores it (and an outbox row if it goes upstream) → responds immediately → `worker` delivers.
5. **Nightly.** `jobs` aggregates activity → outbox → HubSpot.
6. **Staff change.** Identity fix or access correction in `/admin` → written with reason to `audit_log`.

## 6. Non-functional requirements

- **Scale.** 341 members at launch, weekly cohorts; low traffic. Defaults for Lambda and a small RDS instance are ample.
- **Availability.** Single region, single-AZ database. The app tolerates API outages by showing its last good data (CON-01, 04).
- **Backups.** RDS automated backups with point-in-time recovery (proposed 14-day retention), manual snapshot before every migration, and a restore rehearsed from a real production backup into an empty database before the first invite (PLT-07).
- **Security.** TLS everywhere; DB private; least-privilege IAM per function; secrets in Parameter Store; staff actions audited; sign-in rate-limited.
- **Residency.** Member data at rest stays in `ap-southeast-2`. Data that leaves: Expo push (content-free payloads), Sentry (scrubbed errors), the client's existing vendors (HubSpot, Intercom), AaronAI inference (03). State this in the privacy policy.
- **Cost.** Expected well under A$100/month at launch scale (RDS, NAT instance, Lambda, API Gateway, SQS, SES, CloudWatch). Verify with the AWS pricing calculator once the region is confirmed.

## 7. Constraints

| Constraint | How it's met |
| --- | --- |
| CON-03 app talks only to our API | All third-party calls and secrets live in the API |
| CON-07 writes never block a screen | Outbox + SQS + worker |
| CON-08 every write safe to retry | Idempotency key per write; unique constraints; upstream idempotency where supported |
| CON-09 separate environments | **Replaced** by a single production deployment with backups; local dev and third-party sandboxes instead |
| CON-10 error reporting and logs | Sentry + CloudWatch + alarms |
| CON-14 backups | Point-in-time recovery, snapshot before every migration, restore rehearsed before cohort one |
| CON-23 gauges | Canary pull, oldest-payload age, held runs |
| CON-13 room for bookings / Project Acquire | Member-keyed tables; bookings would be their own object table, not counters |

## 8. Decisions

**Agreed with Mark (5 Oct 2026)**
- `/admin` (D-03), the D-01 conditions, the Phase 1 slice (D-26), dropping staging in favour of preview-before-save.

**Made (3 Oct 2026)**
- AWS, client's account (D-27); single production deployment with backups.
- Lambda + Hono; RDS PostgreSQL; Drizzle.
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
- App location — keep the Expo app at the repo root, or move it to `apps/mobile` in one coordinated PR with Shan.
- D-19 — account deletion route.

## 9. Risks

- **No staging.** A bad migration or deploy hits members directly. Mitigated by preview-before-save for rule changes, a whole-base access diff for resolver changes, snapshot-before-migrate, manual approval on deploy, and a rehearsed restore.
- **AWS access lead time.** Nothing deploys until the client grants access (DEP-18) and DNS (DEP-25); SES production access takes a day or so.
- **NAT instance.** Single small instance for outbound calls; auto-recovers, and writes queue meanwhile.

## 10. Out of scope

Staff features inside the member app (ADM-06); the client's own ops console (ADM-07); per-PR preview environments (possible later with Terraform workspaces).
