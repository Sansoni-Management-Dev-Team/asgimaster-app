# resources/vpc/route_table_association

Associates subnets with route tables. Accepts the subnet module outputs directly and computes all associations internally — public subnets are wired to the public route table, private subnets to the private route table.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/route_table_association?ref=v0.0.x"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "route_table" {
  config_path = "../route_table"
}

inputs = {
  public_subnets         = dependency.subnet.outputs.public_subnets
  private_subnets        = dependency.subnet.outputs.private_subnets
  public_route_table_id  = dependency.route_table.outputs.route_tables["public"].id
  private_route_table_id = dependency.route_table.outputs.route_tables["private"].id
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| region | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| public_subnets | Public subnet map from the subnet module output. | `map(object({...}))` | n/a | yes |
| private_subnets | Private subnet map from the subnet module output. | `map(object({...}))` | n/a | yes |
| public_route_table_id | ID of the public route table. | `string` | n/a | yes |
| private_route_table_id | ID of the private route table. For non-live, one shared table. | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| route_table_associations | Map of association key to attributes (id, subnet_id, route_table_id). |
