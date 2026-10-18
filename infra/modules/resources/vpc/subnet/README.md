# resources/vpc/subnet

Creates public, private, and database subnets within a VPC. Subnets are automatically assigned to availability zones in order — the first CIDR maps to the first available AZ, the second to the second, and so on. At least 2 CIDR blocks are required per type to enforce multi-AZ coverage. Database subnets are local-only, same as private subnets (no route to an IGW or NAT gateway) — route table attachment, if any, is handled by the separate `route_table`/`route_table_association` modules.

See `config/config.yml` for the reference YAML format when driving inputs from a config file in the Terragrunt repo.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/subnet?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id         = dependency.vpc.outputs.vpcs["main"].id
  public_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_cidrs  = ["10.0.10.0/24", "10.0.11.0/24"]
  database_cidrs = ["10.0.20.0/24", "10.0.21.0/24"]
  tags           = { Environment = "dev" }
}
```

### Driven from config.yml (Terragrunt repo)

```hcl
locals {
  config = yamldecode(file("${get_terragrunt_dir()}/config.yml"))
}

inputs = {
  vpc_id         = dependency.vpc.outputs.vpcs["main"].id
  public_cidrs   = local.config.subnets.public.cidr_blocks
  private_cidrs  = local.config.subnets.private.cidr_blocks
  database_cidrs = local.config.subnets.database.cidr_blocks
  tags           = { Environment = "dev" }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| vpc_id | ID of the VPC to create subnets in. | `string` | n/a | yes |
| public_cidrs | List of CIDR blocks for public subnets. Minimum 2. | `list(string)` | n/a | yes |
| private_cidrs | List of CIDR blocks for private subnets. Minimum 2. | `list(string)` | n/a | yes |
| database_cidrs | List of CIDR blocks for database subnets. Minimum 2. | `list(string)` | n/a | yes |
| tags | Tags applied to all subnets. A `Name` tag is auto-generated per subnet using the AZ name. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| public_subnets | Map of AZ name to public subnet attributes (id, cidr_block, availability_zone, vpc_id). |
| private_subnets | Map of AZ name to private subnet attributes (id, cidr_block, availability_zone, vpc_id). |
| database_subnets | Map of AZ name to database subnet attributes (id, cidr_block, availability_zone, vpc_id). |
