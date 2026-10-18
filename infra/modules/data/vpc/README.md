# data/vpc

Looks up a single existing VPC by tag and returns its ID. The lookup fails at plan time unless exactly one VPC matches.

Use this to feed a VPC that Terraform doesn't manage, such as the default VPC, into other modules (e.g. a security group module that needs a `vpc_id`). Tag the VPC manually first (e.g. `default = true`), then pass the same key/value pair as `tags`.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//data/vpc?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  tags = {
    default = "true"
  }
}
```

Referencing from another module:

```hcl
dependency "vpc" {
  config_path = "../../data/vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `tags` | Tag key/value pairs identifying the VPC; all pairs must match, and exactly one VPC must match | `map(string)` | — | yes |

## Outputs

| Name | Description |
|------|-------------|
| `vpc_id` | ID of the matching VPC |
