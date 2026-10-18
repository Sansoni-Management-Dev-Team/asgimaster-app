# resources/vpc/nat_gateway

Creates one or more NAT Gateways. Each NAT Gateway must be placed in a public subnet and assigned a pre-allocated Elastic IP. For high availability, deploy one NAT Gateway per AZ.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/nat_gateway?ref=v0.0.x"
}

dependency "eip" {
  config_path = "../eip"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "internet_gateway" {
  config_path = "../internet_gateway"
}

inputs = {
  nat_gateways = {
    az-a = {
      allocation_id = dependency.eip.outputs.eips["nat-az-a"].allocation_id
      subnet_id     = dependency.subnet.outputs.public_subnets["ap-southeast-1a"].id
      tags = {
        Environment = "production"
      }
    }
    az-b = {
      allocation_id = dependency.eip.outputs.eips["nat-az-b"].allocation_id
      subnet_id     = dependency.subnet.outputs.public_subnets["ap-southeast-1b"].id
      tags = {
        Environment = "production"
      }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| nat_gateways | Map of NAT Gateways to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |
| nat_gateways.allocation_id | Allocation ID of the Elastic IP to associate with the NAT Gateway. | `string` | n/a | yes |
| nat_gateways.subnet_id | ID of the public subnet to place the NAT Gateway in. | `string` | n/a | yes |
| nat_gateways.tags | Tags to apply to the NAT Gateway. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| nat_gateways | Map of NAT Gateway key to attributes (id, subnet_id, public_ip). |
