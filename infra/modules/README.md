# terraform-modules

> Copied on 18 October 2026 from Sansoni's `devops-terraform-modules` repository at tag `0.0.24` (commit `6523ea6`). This copy is now the source. The units in `../applications` use these modules by local path, not by `?ref=` pins.

Reusable Terraform modules consumed via [Terragrunt](https://terragrunt.gruntwork.io/).

## Overview

This repository contains low-level Terraform modules only — no root configurations, no state backends, no provider authentication. All orchestration, environment composition, and DRY wiring is handled by a separate Terragrunt repository that references these modules as sources.

## Repository Structure

Modules are grouped by domain under three top-level directories:

```
terraform-modules/
├── aws_sso/                        # IAM Identity Center management
│   ├── aws_account/
│   ├── aws_account_assignment/
│   ├── aws_group_membership/
│   ├── aws_groups/
│   ├── aws_ou/
│   ├── aws_permission_sets/
│   └── aws_users/
├── data/                           # Read-only data source lookups
│   ├── accounts/
│   ├── organization/
│   └── sso_instance/
└── resources/                      # AWS resource provisioning
    ├── acm/
    └── route53/
        ├── hosted_zone/
        └── record/
```

Each module directory contains exactly these files:

```
<group>/<module>/
├── main.tf        # Resource or data source definitions
├── variables.tf   # All input variables
├── outputs.tf     # All outputs
├── provider.tf    # AWS provider block (uses var.region)
├── versions.tf    # required_version and required_providers constraints
└── README.md      # Usage, inputs, and outputs
```

## Conventions

- **Naming**: all directory and variable names use `snake_case`.
- **Resource label**: the main resource or data source in a module is always named `this`.
- **Bulk creation**: modules use `for_each = var.<collection>` over a `map(object(...))` input so callers create any number of resources with a single module invocation.
- **Region**: every module exposes a `region` variable (default `"ap-southeast-1"`) consumed by `provider.tf`.
- **Provider**: the AWS provider is declared in `provider.tf` and pinned to `>= 6.0` in `versions.tf`. No provider authentication is configured here — the caller's environment (via Terragrunt) supplies credentials.
- **Outputs**: each output mirrors the input map key so callers can reference individual entries by the same key they supplied.
- **No cross-module dependencies**: modules are self-contained. Cross-module data flows through Terragrunt `dependency` blocks in the calling repository.

## Versioning

Modules are versioned via git tags (`v0.0.x`) and referenced from Terragrunt configurations with a `?ref=` pin:

```hcl
# In your Terragrunt repo
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//<group>/<module>?ref=v0.0.9"
}
```

For nested modules (e.g., `resources/route53/hosted_zone`):

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/route53/hosted_zone?ref=v0.0.9"
}
```

A single tag covers the entire repository. Bump the tag on every merge that changes any module.

## Contributing

1. Create the module directory under the appropriate group (`aws_sso/`, `data/`, or `resources/`).
2. Add all six files: `main.tf`, `variables.tf`, `outputs.tf`, `provider.tf`, `versions.tf`, `README.md`.
3. Follow the map-of-objects input pattern and name the primary resource `this`.
4. Open a pull request — CI runs `terraform validate` and `terraform fmt -check` against all modules.
5. On merge, tag a new release following [semver](https://semver.org/).
