# data/accounts

Fetches all AWS accounts in the organization and exposes them as a name-keyed map.

Use this as a cross-repo dependency to look up account IDs created by the `aws_sso/aws_account` module without requiring a direct Terragrunt dependency.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//data/accounts?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}
```

Referencing from another module:

```hcl
dependency "accounts" {
  config_path = "../../data/accounts"
}

inputs = {
  assignments = {
    admins-prod = {
      account_id         = dependency.accounts.outputs.accounts["prod"].id
      group_id           = dependency.groups.outputs.groups["admins"].group_id
      permission_set_arn = dependency.permission_sets.outputs.permission_sets["admin"].permission_set_arn
    }
    admins-staging = {
      account_id         = dependency.accounts.outputs.accounts["staging"].id
      group_id           = dependency.groups.outputs.groups["admins"].group_id
      permission_set_arn = dependency.permission_sets.outputs.permission_sets["admin"].permission_set_arn
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `accounts` | Map of account name to `{ id, arn }` |
