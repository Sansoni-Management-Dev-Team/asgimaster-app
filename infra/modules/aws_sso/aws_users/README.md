# aws_sso/aws_users

Creates one or more users in AWS IAM Identity Center. AWS automatically sends a password setup email to each user's email address upon creation.

Obtain `identity_store_id` from the `data/sso_instance` module.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_users?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "sso" {
  config_path = "../../data/sso_instance"
}

inputs = {
  identity_store_id = dependency.sso.outputs.identity_store_id

  users = {
    john-doe = {
      display_name = "John Doe"
      user_name    = "john.doe"
      given_name   = "John"
      family_name  = "Doe"
      email        = "john.doe@yourdomain.com"
    }
    jane-smith = {
      display_name = "Jane Smith"
      user_name    = "jane.smith"
      given_name   = "Jane"
      family_name  = "Smith"
      email        = "jane.smith@yourdomain.com"
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `users` | Map of user key to `{ user_id, user_name }` |
