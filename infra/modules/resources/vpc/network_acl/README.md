# resources/vpc/network_acl

Creates one or more Network ACLs within a VPC. NACLs are stateless subnet-level firewalls. After creating a NACL, use the `network_acl_association` module to attach it to subnets and the `network_acl_rule` module to define allow/deny rules.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  network_acls = {
    public = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      tags   = { Name = "public" }
    }
    private = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      tags   = { Name = "private" }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| network_acls | Map of Network ACLs to create. The key is used as a unique identifier. | `map(object({...}))` | n/a | yes |
| network_acls.vpc_id | ID of the VPC to create the Network ACL in. | `string` | n/a | yes |
| network_acls.tags | Tags to apply to the Network ACL. | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| network_acls | Map of Network ACL key to attributes (id, vpc_id). |
