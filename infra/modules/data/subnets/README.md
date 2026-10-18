# data/subnets

Looks up existing subnets by tag and returns their subnet IDs and VPC IDs.

Use this to feed subnets that Terraform doesn't manage, such as the default VPC's subnets, into other modules (e.g. `resources/rds/aurora_serverless`). Tag the subnets manually first (e.g. `default = true`), then pass the same key/value pair as `tags`.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//data/subnets?ref=v0.0.1"
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
dependency "subnets" {
  config_path = "../../data/subnets"
}

inputs = {
  subnet_ids = dependency.subnets.outputs.subnet_ids
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `tags` | Tag key/value pairs a subnet must have to be selected; all pairs must match | `map(string)` | — | yes |

## Outputs

| Name | Description |
|------|-------------|
| `subnet_ids` | List of matching subnet IDs |
| `vpc_ids` | Distinct VPC IDs of the matching subnets |
| `subnets` | Map of subnet ID to `{ vpc_id, availability_zone, cidr_block }` |
