# infra

This folder holds the Terragrunt for the asgi AWS resources. It was copied on 18 October 2026 from Sansoni's `devops-infrastructure-asgi-app` repository, at commit `58458b0`. Sansoni DevOps (Rodney) maintains it here, next to the code.

The AWS account is `806968064090` and the region is `ap-southeast-2`. The account belongs to Sansoni.

## Layout

- `root.hcl` sets the S3 state bucket and the DynamoDB lock table. Each unit keeps its state under its path from this folder, for example `applications/modules/vpc/vpc/tf.tfstate`. These paths are the same as in the old repository, so this folder uses the existing state.
- `applications/region.hcl`, `applications/tags.hcl` and `applications/domain.hcl` hold the settings for each environment.
- `applications/modules/<service>/terragrunt.hcl` is one unit for each group of resources. Each unit uses a pinned version of Sansoni's private `devops-terraform-modules` repository.
- `scripts/propagate` holds Rodney's scripts that add the hosted zone's NS records to the parent zone in Sansoni's system account.

## Environments

`TG_VAR_ENVIRONMENT` picks the environment.

- `develop` is the only environment that is set up. It uses `asgi.pajamaprofits.net`, which is an internal staging domain.
- `staging` is defined but not set up.
- `production` is defined, but its domain is not decided yet, so it has no entry in `domain.hcl`. Any run for `production` fails until the domain is added.

## Tool versions

`.terragrunt-version` and `.opentofu-version` pin the versions. [tenv](https://github.com/tofuutils/tenv) reads these files locally, and the GitHub workflow reads them too.

## Running a plan locally

You need git access to `devops-terraform-modules` and the `sansoni` AWS profile.

OpenTofu cannot read a profile set up with `aws login`. Add a second profile to `~/.aws/config` that asks the AWS CLI for credentials:

```ini
[profile sansoni-tofu]
region = ap-southeast-2
credential_process = aws configure export-credentials --profile sansoni --format process
```

Then run the plan:

```sh
cd infra
AWS_PROFILE=sansoni-tofu TG_VAR_ENVIRONMENT=develop terragrunt run --all plan
```

Never run `apply` without agreeing it with Rodney first.

## GitHub Actions

`.github/workflows/infra.yml` runs Terragrunt for each branch:

| Branch       | Environment         | Pull request | Push  |
| ------------ | ------------------- | ------------ | ----- |
| `main`       | `develop` (staging) | plan         | apply |
| `production` | `production`        | plan         | apply |

It uses `github-role` through OIDC and the `TF_MODULES_PAT` secret to read the private modules. Apply jobs run in the GitHub environment of the same name, so reviewers can be required there. `production` fails until its domain and its state bucket exist.

## The ECS task definition and service

The app deploy in `.github/workflows/main.yml` registers new task definitions and points the service at them. The `ecs/task_definition` and `ecs/service` units only create the first `httpd` placeholder. They are excluded from `apply` for `develop`, as the comment in each unit says, so that Terragrunt does not roll the service back to the placeholder.
