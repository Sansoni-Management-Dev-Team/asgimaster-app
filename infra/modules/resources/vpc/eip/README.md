# resources/vpc/eip

Creates one or more Elastic IP addresses scoped to the VPC domain. Intended to be used as the static public IP for NAT Gateways — create one EIP per AZ.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/eip?ref=v0.0.x"
}

inputs = {
  eips = {
    nat-az-a = {
      tags = {
        Environment = "production"
        Name        = "nat-az-a"
      }
    }
    nat-az-b = {
      tags = {
        Environment = "production"
        Name        = "nat-az-b"
      }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| eips | Map of Elastic IPs to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |
| eips.tags | Tags to apply to the Elastic IP. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| eips | Map of EIP key to EIP attributes (id, public_ip, allocation_id). |
