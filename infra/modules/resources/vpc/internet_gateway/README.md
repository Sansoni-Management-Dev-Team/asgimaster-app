# resources/vpc/internet_gateway

Creates one or more Internet Gateways and attaches them to the specified VPC. One IGW per VPC is the standard setup — it gives public subnets a route to and from the internet.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/internet_gateway?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  internet_gateways = {
    main = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
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
| internet_gateways | Map of Internet Gateways to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |
| internet_gateways.vpc_id | ID of the VPC to attach the Internet Gateway to. | `string` | n/a | yes |
| internet_gateways.tags | Tags to apply to the Internet Gateway. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| internet_gateways | Map of Internet Gateway key to attributes (id, vpc_id). |
