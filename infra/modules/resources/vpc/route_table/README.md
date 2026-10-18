# resources/vpc/route_table

Creates one or more route tables with inline routes. Public subnets share a single route table pointing to the Internet Gateway. Private subnets each get their own route table pointing to the NAT Gateway in their AZ.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/route_table?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "internet_gateway" {
  config_path = "../internet_gateway"
}

dependency "nat_gateway" {
  config_path = "../nat_gateway"
}

inputs = {
  route_tables = {
    public = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block = "0.0.0.0/0"
          gateway_id = dependency.internet_gateway.outputs.internet_gateways["main"].id
        }
      }
      tags = { Name = "public" }
    }
    private-az-a = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block     = "0.0.0.0/0"
          nat_gateway_id = dependency.nat_gateway.outputs.nat_gateways["az-a"].id
        }
      }
      tags = { Name = "private-az-a" }
    }
    private-az-b = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block     = "0.0.0.0/0"
          nat_gateway_id = dependency.nat_gateway.outputs.nat_gateways["az-b"].id
        }
      }
      tags = { Name = "private-az-b" }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| route_tables | Map of route tables to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |
| route_tables.vpc_id | ID of the VPC to create the route table in. | `string` | n/a | yes |
| route_tables.routes | Map of routes keyed by a unique name. Each route requires a cidr_block and one of gateway_id or nat_gateway_id. | `map(object({...}))` | `{}` | no |
| route_tables.tags | Tags to apply to the route table. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| route_tables | Map of route table key to attributes (id, vpc_id). |
