# aws_sso/aws_ou

Creates one or more AWS Organizations Organizational Units (OUs) under a given parent root or OU.

Obtain `parent_id` from the `data/organization` module.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//aws_sso/aws_ou?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "org" {
  config_path = "../../data/organization"
}

inputs = {
  parent_id = dependency.org.outputs.root_id

  organizational_units = ["workloads", "sandbox", "security"]

  tags = {
    ManagedBy = "terragrunt"
  }
}
```

## Outputs

| Name | Description |
|------|-------------|
| `organizational_units` | Map of OU name to `{ id, arn }` |
