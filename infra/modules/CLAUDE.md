# CLAUDE.md

> Copied on 18 October 2026 from Sansoni's `devops-terraform-modules` repository at tag `0.0.24` (commit `6523ea6`). This copy is now the source. The units in `../applications` use these modules by local path, not by `?ref=` pins.

This repository contains reusable Terraform modules. Modules are not applied directly — they are consumed by a separate Terragrunt repository via `?ref=` pins.

## Repository layout

Three top-level groups organize modules by purpose:

| Group | Purpose |
|-------|---------|
| `aws_sso/` | IAM Identity Center: accounts, OUs, groups, users, permission sets, assignments |
| `data/` | Read-only data source lookups (organization, accounts, SSO instance) |
| `resources/` | AWS resource provisioning (ACM, Route53); may be nested one level (e.g., `resources/route53/hosted_zone`) |

## Module file structure

Every module contains exactly these six files — no more, no less:

| File | Role |
|------|------|
| `main.tf` | Resource or data source blocks |
| `variables.tf` | All input variables with types and descriptions |
| `outputs.tf` | All outputs callers may need |
| `provider.tf` | `provider "aws" { region = var.region }` |
| `versions.tf` | `required_version` and `required_providers` constraints |
| `README.md` | Module description, inputs table, outputs table, sample Terragrunt usage |

Do not add `locals.tf`, `data.tf`, or any other file split unless the module is large enough to justify it (it hasn't been needed yet).

## Authoring conventions

### Resource naming

Always name the primary resource or data source `this`:

```hcl
resource "aws_acm_certificate" "this" { ... }
data "aws_organizations_organization" "this" {}
```

### Map-of-objects input pattern

Every module accepts a `map(object(...))` as its primary input. This lets callers create any number of resources in one invocation. The map key is used as the `for_each` key and appears in the output.

```hcl
# variables.tf
variable "certificates" {
  description = "Map of ACM certificates to create. The key is used as a unique identifier."
  type = map(object({
    domain_name       = string
    validation_method = optional(string, "DNS")
    tags              = optional(map(string), {})
  }))
}

# main.tf
resource "aws_acm_certificate" "this" {
  for_each          = var.certificates
  domain_name       = each.value.domain_name
  validation_method = each.value.validation_method
  tags              = each.value.tags
}
```

Use `optional(type, default)` for fields that have sensible defaults. Required fields have no default.

### Config file vs. plain variable

Two ways to express the primary input:

- **Plain `map(object(...))` variable** (as above) — default choice. Use it when the module manages a single flat collection of similarly-shaped items (e.g. `resources/acm`, `resources/route53/hosted_zone`).
- **`config_file` + `yamldecode`** — use instead when any of these apply:
  - The config spans multiple related collections or nested sub-blocks (e.g. clusters *and* per-cluster instances, security groups *and* their ingress/egress rules).
  - Entries need to reference external files, e.g. `templatefile()` for an IAM policy or assume-role document (see `resources/iam/role`).
  - Expressing the shape as a single HCL `object(...)` type would be awkward or deeply nested.

  ```hcl
  # variables.tf
  variable "config_file" {
    description = "Path to the YAML configuration file defining <things>."
    type        = string
  }

  # main.tf
  locals {
    config = yamldecode(file(var.config_file))
    things = local.config.things
  }

  resource "aws_thing" "this" {
    for_each = local.things
    # ...
  }
  ```

  The module directory gets a seventh item — a `config/` subdirectory holding a sample `config.yml` (and any referenced template files) — documented in the README alongside the other inputs. This is the one case where the "six files only" rule extends.

Never load config values that are secrets (passwords, API keys) via `config_file`. Secrets are created and populated outside Terraform (see the no-auto-credentials convention below) and referenced only by ID/ARN.

### Region variable

Every module declares the `region` variable and uses it in `provider.tf`. Do not hardcode a region anywhere else.

```hcl
# variables.tf
variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

# provider.tf
provider "aws" {
  region = var.region
}
```

### versions.tf

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}
```

### Outputs

Mirror the input map key so callers can reference entries by the same key they supplied:

```hcl
output "certificates" {
  description = "Map of certificate key to certificate attributes."
  value = {
    for key, cert in aws_acm_certificate.this : key => {
      arn    = cert.arn
      status = cert.status
    }
  }
}
```

Only expose attributes that callers actually need. Do not output the full resource object.

### No cross-module calls

Modules never call other modules inside this repository. Cross-module data (e.g., an SSO instance ARN used by an account assignment) flows through Terragrunt `dependency` blocks in the calling repository.

### Credentials are never auto-generated

Modules never create, generate, or let AWS auto-manage secrets on their behalf — no `random_password`, no `manage_master_user_password = true`, no writing plaintext credentials into a config file or `tags`. Passwords and other credential material are created and populated manually in Secrets Manager outside Terraform.

A module that needs credentials at apply time accepts a secret ID/ARN as input (per-item, via `config_file`, or as a plain variable) and reads it with a data source:

```hcl
data "aws_secretsmanager_secret_version" "this" {
  for_each  = local.things
  secret_id = each.value.credentials_secret_id
}

locals {
  credentials = {
    for key, version in data.aws_secretsmanager_secret_version.this :
    key => jsondecode(version.secret_string)
  }
}
```

Terraform automatically propagates the sensitivity of `secret_string` to anything derived from it, so avoid outputting decoded credential fields directly — output the secret ID/ARN instead if callers need a reference back to it.

Resource-level encryption (e.g. RDS storage encryption) still uses a KMS key managed by Terraform — see `resources/kms` — since a CMK is not a credential. Only the actual username/password/API-key material is out of Terraform's hands.

## Module README format

Each module's `README.md` follows this structure:

```markdown
# <group>/<module>

One-paragraph description of what the module does and when to use it.

## Sample Terragrunt Usage

(full hcl block with dependency blocks and inputs example)

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
...

## Outputs

| Name | Description |
|------|-------------|
...
```

The header matches the module's path relative to the repo root (e.g., `# resources/acm`, `# aws_sso/aws_account_assignment`).

## Versioning

A single semver git tag (`v0.0.x`) covers the whole repository. Bump on every merge that changes any module. Callers pin via `?ref=`:

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/acm?ref=v0.0.9"
}
```

## Adding a new module

1. Choose or create a group directory (`aws_sso/`, `data/`, `resources/`).
2. Create the module directory with `snake_case` naming.
3. Add all six required files.
4. Follow the map-of-objects pattern for the primary input (or the `config_file` pattern if it applies — see above).
5. Name the primary resource `this`.
6. Write the `README.md` using the format above.
7. Run `terraform validate` and `terraform fmt` locally before opening a PR.

## What this repo does NOT contain

- No root Terraform configurations
- No state backend configuration
- No provider authentication (credentials come from the Terragrunt caller's environment)
- No `.tfvars` files
- No Terragrunt files (`terragrunt.hcl`)
