# Architecture

This page shows the V1 architecture for the Sansoni member app and lists the AWS resources it needs. The design reasoning is in [HLDD 01](hldd/01-platform-api-admin.md) and [HLDD 03](hldd/03-integrations.md).

AWS resources run in Sansoni's account `806968064090` in `ap-southeast-2` (Sydney). The current environment is `develop`. A staging environment is defined but has not been provisioned, and there is no production environment yet. Resources live in Sansoni's [devops-infrastructure-asgi-app](https://github.com/Sansoni-Management-Dev-Team/devops-infrastructure-asgi-app) repository and are owned by Sansoni DevOps.

The app repository is [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app). Its `.github/workflows/main.yml` and `taskdef.json` follow Sansoni's empireone deploy pattern using shared actions from `devops-github-workflows`. Relevant pushes to `main` build the API image, upload an environment file to S3, push to ECR, register a task definition and update the ECS service. Pull requests run lint, typecheck, tests and a Docker build without deploying. There is no migration step yet.

## Diagram

Solid green boxes are provisioned by Sansoni DevOps. Dashed boxes are planned. Grey boxes are outside AWS. The API routes, admin, poller and scheduled jobs shown here describe the V1 design. The service currently runs a placeholder image and our API implements `/` and `/health`. CloudWatch logs and SES domain verification exist, while alarms and email delivery permissions remain to be added.

```mermaid
flowchart TB
  app["Member app<br/>Expo, iOS and Android"]
  staff["Staff browser<br/>/admin"]
  ext["Third parties<br/>HubSpot, Maxio, Intercom, Mux,<br/>AaronAI, Expo push, Sentry"]
  gha["GitHub Actions"]
  ops["Client ops tooling<br/>read-only, D-05"]

  subgraph aws["Sansoni AWS account, ap-southeast-2"]
    dns["Route 53 and ACM<br/>app.asgi.pajamaprofits.net"]
    scheduler["EventBridge Scheduler"]
    subgraph vpc["VPC"]
      subgraph public["Public subnets"]
        alb["Application load balancer"]
      end
      subgraph private["Private subnets"]
        api["ECS Fargate service: asgi-app-develop<br/>Hono: /v1, /admin, /webhooks<br/>and the outbox poller"]
        jobs["ECS scheduled task: jobs<br/>same image as api"]
      end
      subgraph database["Database subnets"]
        rds[("Aurora PostgreSQL 18.6")]
      end
    end
    ecr["ECR<br/>API images"]
    secrets["Secrets Manager"]
    logs["CloudWatch<br/>logs and alarms"]
    ses["SES<br/>invite and sign-in email"]
  end

  app -- HTTPS --> dns
  staff -- HTTPS --> dns
  ext -- "webhooks" --> dns
  dns --> alb --> api
  scheduler --> jobs
  api --> rds
  jobs --> rds
  api -- "HTTPS out" --> ext
  jobs -- "HTTPS out" --> ext
  app -- "Intercom SDK,<br/>Mux playback" --> ext
  api --> ses
  api --> logs
  ecr -. image .-> api
  secrets -. "at start" .-> api
  gha -. "OIDC deploy" .-> ecr
  ops -.-> rds

  classDef built fill:#d8f3dc,stroke:#2d6a4f,color:#1b4332
  classDef planned fill:#ffffff,stroke:#6c757d,stroke-dasharray:5 4,color:#343a40
  classDef external fill:#e9ecef,stroke:#adb5bd,color:#343a40
  class alb,api,rds,ecr,secrets,logs,dns,ses built
  class jobs,scheduler,gha planned
  class app,staff,ops,ext external
  style aws fill:#fff8e6,stroke:#e0a100
  style vpc fill:#fffdf5,stroke:#e0a100
  style public fill:#ffffff,stroke:#adb5bd
  style private fill:#ffffff,stroke:#adb5bd
  style database fill:#ffffff,stroke:#adb5bd
```

How requests flow:

- The app and staff browsers call one host over HTTPS. The load balancer sends every request to the `asgi-app-develop` service.
- The API reads and writes RDS. RDS has no route to the internet and only accepts connections from the ECS tasks.
- The API writes changes for third parties to an outbox table in RDS. A poller in the API sends them and retries failures. There is no message queue.
- EventBridge Scheduler starts the `jobs` task for nightly work, e.g., the full Maxio pull.
- Maxio and Mux send webhooks to `/webhooks/*` on the same host. SES reports email bounces through SNS to the same path.
- The app talks to two third parties directly. It uses the Intercom SDK for support and plays Mux video with URLs that the API signs.
- The ECS tasks run in private subnets and reach third parties through a NAT gateway.

## AWS resources

| Resource                                                                    | Purpose                                                               | Status                                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| VPC, public, private and database subnets, internet gateway and NAT gateway | Network for the load balancer, tasks and database                     | Provisioned by Sansoni DevOps.                                                                   |
| Application load balancer                                                   | HTTPS entry point for `app.asgi.pajamaprofits.net`                    | Provisioned. Target group checks `/`, which the API answers without a database call.             |
| ECS cluster `asgi-main-develop` and service `asgi-app-develop`              | Runs one task with 0.25 vCPU and 512 MB on x86                        | Provisioned with a placeholder image.                                                            |
| ECR repository `asgi-asgi-app-develop`                                      | Stores API images tagged `v.<short sha>`                              | Provisioned with immutable tags and scanning on push.                                            |
| Aurora Serverless v2, PostgreSQL 18.6                                       | Main database `asgi`, capacity from 0 to 2 units, 7 days of backups   | Provisioned with deletion protection.                                                            |
| Secrets Manager `asgi-secrets-develop`                                      | Database credentials                                                  | Username and password configured. Host, port and database keys still needed.                     |
| CloudWatch log group `/ecs/asgi-app-develop`                                | API logs, kept for 14 days                                            | Provisioned.                                                                                     |
| IAM execution role `asgi-ecs-task-execution-develop`                        | Image pulls, logs and secret reads                                    | Provisioned. S3 environment file access still needed.                                            |
| IAM task role `asgi-app-develop`                                            | ECS Exec                                                              | Provisioned. SES send permission still needed.                                                   |
| Route 53 and ACM                                                            | HTTPS for `app.asgi.pajamaprofits.net`                                | Provisioned.                                                                                     |
| SES domain `asgi.pajamaprofits.net`                                         | Invite and sign-in email                                              | Verified domain. Application integration still planned.                                          |
| S3 bucket `asgi-main-develop`                                               | Versioned storage                                                     | Provisioned. Used for the `.env` file by agreement with Tom. Execution role access still needed. |
| EventBridge Scheduler and ECS task `jobs`                                   | Nightly and hourly jobs                                               | Planned.                                                                                         |
| SES configuration set and SNS topic                                         | Email bounces and complaints                                          | Planned.                                                                                         |
| CloudWatch alarms                                                           | 5xx rate, task restarts, failed outbox rows, database storage and CPU | Planned.                                                                                         |
| IAM role `github-role`                                                      | OIDC access for GitHub Actions                                        | Provisioned.                                                                                     |

Resource names above are derived from the asgi Terragrunt inputs and the module versions they pin in `devops-terraform-modules`. The ECR module adds the project and environment to the `asgi-app` config key, which produces `asgi-asgi-app-develop`.

Rodney must review the workflow before the first merge. The `.env` file uses the provisioned `asgi-main-develop` bucket. The task execution role needs permission to read the environment file, so deployment will fail until Rodney grants it. The existing target group checks `/` and the container checks `/health`. Both routes return 200 without a database call. Merging the workflow will trigger the first deploy attempt. Database migrations need a separate agreement when they exist.

## Third-party access

The API needs these credentials. They are not configured yet. Agree their delivery to Sansoni DevOps for storage in `asgi-secrets-develop`. They never belong in the app.

| System   | Access                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------ |
| Maxio    | Read-only API key and webhooks, AU and NZ accounts (memberships, payments, subscription changes) |
| HubSpot  | Private app token. Sam to confirm the exact scopes.                                              |
| Intercom | Identity verification secret                                                                     |
| Mux      | API token and playback signing key                                                               |
| AaronAI  | Service credential                                                                               |
| Sentry   | DSN for the API and the app                                                                      |

The app also needs Apple and Google developer accounts to publish to the stores.
