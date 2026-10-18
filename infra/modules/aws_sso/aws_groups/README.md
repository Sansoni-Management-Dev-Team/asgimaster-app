# aws_sso/aws_groups

Creates one or more groups in AWS IAM Identity Center.

Obtain `identity_store_id` from the `data/sso_instance` module.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_groups?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "sso" {
  config_path = "../../data/sso_instance"
}

inputs = {
  identity_store_id = dependency.sso.outputs.identity_store_id

  groups = {
    platform-admins = {
      display_name = "Platform Admins"
      description  = "Full access to platform accounts"
    }
    developers = {
      display_name = "Developers"
      description  = "Read/write access to workload accounts"
    }
    read-only = {
      display_name = "Read Only"
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `groups` | Map of group key to `{ group_id, display_name }` |
