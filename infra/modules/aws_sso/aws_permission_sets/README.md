# aws_sso/aws_permission_sets

Creates one or more permission sets in AWS IAM Identity Center using predefined AWS managed policies. Session duration defaults to 1 hour.

Obtain `instance_arn` from the `data/sso_instance` module.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_permission_sets?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "sso" {
  config_path = "../../data/sso_instance"
}

inputs = {
  instance_arn = dependency.sso.outputs.instance_arn

  tags = {
    ManagedBy   = "Terraform"
    Environment = "production"
  }

  permission_sets = {
    admin = {
      name        = "AdministratorAccess"
      description = "Full administrative access"
      managed_policies = [
        "arn:aws:iam::aws:policy/AdministratorAccess",
      ]
    }
    power-user = {
      name        = "PowerUserAccess"
      description = "Power user access excluding IAM"
      managed_policies = [
        "arn:aws:iam::aws:policy/PowerUserAccess",
      ]
    }
    read-only = {
      name             = "ReadOnlyAccess"
      description      = "Read-only access to all services"
      session_duration = "PT2H"
      managed_policies = [
        "arn:aws:iam::aws:policy/ReadOnlyAccess",
      ]
    }
    billing = {
      name        = "BillingAccess"
      description = "Access to billing and cost management"
      managed_policies = [
        "arn:aws:iam::aws:policy/job-function/Billing",
      ]
    }
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `permission_sets` | Map of permission set key to `{ permission_set_arn, name }` |
