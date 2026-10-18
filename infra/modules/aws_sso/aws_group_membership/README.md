# aws_sso/aws_group_membership

Adds one or more users to groups in AWS IAM Identity Center.

Obtain `identity_store_id` from the `data/sso_instance` module. Use `group_id` from the `aws_groups` module output and `user_id` from the `aws_users` module output.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_group_membership?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "sso" {
  config_path = "../../data/sso_instance"
}

dependency "groups" {
  config_path = "../aws_groups"
}

dependency "users" {
  config_path = "../aws_users"
}

inputs = {
  identity_store_id = dependency.sso.outputs.identity_store_id

  memberships = {
    admins = {
      group_id = dependency.groups.outputs.groups["platform-admins"].group_id
      users = [
        dependency.users.outputs.users["alice"].user_id,
        dependency.users.outputs.users["bob"].user_id,
      ]
    }
    developers = {
      group_id = dependency.groups.outputs.groups["developers"].group_id
      users = [
        dependency.users.outputs.users["charlie"].user_id,
        dependency.users.outputs.users["dave"].user_id,
      ]
    }
    read-only = {
      group_id = dependency.groups.outputs.groups["read-only"].group_id
      users = [
        dependency.users.outputs.users["eve"].user_id,
      ]
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `memberships` | Map of flattened membership key (`group_key:user_id`) to `{ membership_id, group_id, user_id }` |
