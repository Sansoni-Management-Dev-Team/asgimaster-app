# aws_sso/aws_account

Creates one or more AWS member accounts inside an AWS Organization. Accounts can optionally be placed under a specific OU; if `parent_id` is omitted the account is created directly under the root.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_account?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "ou" {
  config_path = "../aws_ou"
}

inputs = {
  accounts = {
    workloads-prod = {
      name      = "workloads-prod"
      email     = "aws+workloads-prod@yourdomain.com"
      parent_id = dependency.ou.outputs.organizational_units["workloads"].id
      tags      = { Environment = "prod" }
    }
    sandbox = {
      name  = "sandbox"
      email = "aws+sandbox@yourdomain.com"
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `accounts` | Map of account key to `{ id, arn }` |
