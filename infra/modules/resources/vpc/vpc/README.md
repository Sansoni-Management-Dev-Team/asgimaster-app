# resources/vpc/vpc

Creates one or more AWS VPCs. DNS support and DNS hostnames are enabled by default.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/vpc?ref=v0.0.x"
}

inputs = {
  vpcs = {
    main = {
      cidr_block = "10.0.0.0/16"
      tags = {
        Name        = "main"
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
| vpcs | Map of VPCs to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| vpcs | Map of VPC key to VPC attributes (id, cidr_block). |
