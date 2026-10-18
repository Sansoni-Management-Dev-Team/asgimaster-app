# resources/iam/user

Creates one or more IAM users. Each user can optionally be added to existing IAM groups and/or have managed policies attached directly. Use this for service/automation accounts (e.g. `planka`) that need a long-lived AWS identity, as well as for human users.

**Access keys are intentionally out of scope for this module.** Per this repo's no-auto-credentials convention, Terraform never generates or writes credential material — an access key's secret is exactly that. After creating a user here, generate its access key manually (AWS Console or `aws iam create-access-key`) and store it yourself in Secrets Manager, e.g. as a secret named `planka/access-keys` with keys:

```
PLANKA_ACCESS_KEYS = <access key id>
PLANKA_SECRET_KEYS = <secret access key>
```

Any module or Terragrunt unit that needs those credentials at apply time should accept the secret ID/ARN as an input and read it via `data "aws_secretsmanager_secret_version"`, never by recreating or importing the key material into Terraform.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/iam/user?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  users = {
    planka = {
      groups              = ["service-accounts"]
      managed_policy_arns = ["arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"]
      tags                = { Purpose = "planka-s3-access" }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `users` | Map of IAM users to create. The key is used as the IAM user name | `map(object)` | — | yes |
| `users[*].path` | IAM path for the user | `string` | `"/"` | no |
| `users[*].permissions_boundary` | ARN of the managed policy to use as a permissions boundary | `string` | `null` | no |
| `users[*].groups` | List of existing IAM group names to add the user to | `list(string)` | `[]` | no |
| `users[*].managed_policy_arns` | List of managed policy ARNs to attach directly to the user | `list(string)` | `[]` | no |
| `users[*].tags` | Tags to apply to the user | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `users` | Map of user key to `{ arn, name, id }` |
