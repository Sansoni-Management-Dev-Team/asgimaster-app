# aws_sso/aws_account_assignment

Assigns groups to AWS accounts with a permission set in IAM Identity Center.

Each entry grants one group a permission set on one or more accounts. Obtain `instance_arn` from the `data/sso_instance` module, `group_id` from the `aws_groups` module, `accounts` (a list of account IDs) from the `data/accounts` module, and `permission_set_arn` from the `aws_permission_sets` module.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_account_assignment?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "sso" {
  config_path = "../../data/sso_instance"
}

dependency "accounts" {
  config_path = "../../data/accounts"
}

dependency "groups" {
  config_path = "../aws_groups"
}

dependency "permission_sets" {
  config_path = "../aws_permission_sets"
}

inputs = {
  instance_arn = dependency.sso.outputs.instance_arn

  assignments = {
    admins = {
      group_id = dependency.groups.outputs.groups["admins"].group_id
      accounts = [
        dependency.accounts.outputs.accounts["prod"].id,
        dependency.accounts.outputs.accounts["staging"].id,
      ]
      permission_set_arn = dependency.permission_sets.outputs.permission_sets["admin"].permission_set_arn
    }
    developers = {
      group_id = dependency.groups.outputs.groups["developers"].group_id
      accounts = [
        dependency.accounts.outputs.accounts["prod"].id,
      ]
      permission_set_arn = dependency.permission_sets.outputs.permission_sets["power-user"].permission_set_arn
    }
    read-only = {
      group_id = dependency.groups.outputs.groups["read-only"].group_id
      accounts = [
        dependency.accounts.outputs.accounts["prod"].id,
      ]
      permission_set_arn = dependency.permission_sets.outputs.permission_sets["read-only"].permission_set_arn
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| `instance_arn` | ARN of the IAM Identity Center instance. | `string` | - | yes |
| `assignments` | Map of account assignments to create. Each entry grants a group a permission set on one or more AWS accounts. The key is used as a unique identifier. | `map(object({ group_id = string, accounts = list(string), permission_set_arn = string }))` | - | yes |

## Outputs

| Name | Description |
|------|-------------|
| `assignments` | Map of assignment key (`"<key>-<account_id>"`) to `{ account_id, group_id, permission_set_arn }` |
