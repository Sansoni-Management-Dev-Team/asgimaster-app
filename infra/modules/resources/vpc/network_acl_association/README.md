# resources/vpc/network_acl_association

Associates subnets with Network ACLs. Accepts the subnet module outputs directly and computes all associations internally — public subnets are wired to the public NACL, private subnets to the private NACL.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl_association?ref=v0.0.x"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "network_acl" {
  config_path = "../network_acl"
}

inputs = {
  public_subnets         = dependency.subnet.outputs.public_subnets
  private_subnets        = dependency.subnet.outputs.private_subnets
  public_network_acl_id  = dependency.network_acl.outputs.network_acls["public"].id
  private_network_acl_id = dependency.network_acl.outputs.network_acls["private"].id
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| public_subnets | Public subnet map from the subnet module output. | `map(object({...}))` | n/a | yes |
| private_subnets | Private subnet map from the subnet module output. | `map(object({...}))` | n/a | yes |
| public_network_acl_id | ID of the Network ACL to associate with public subnets. | `string` | n/a | yes |
| private_network_acl_id | ID of the Network ACL to associate with private subnets. | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| network_acl_associations | Map of association key to attributes (id, network_acl_id, subnet_id). |
