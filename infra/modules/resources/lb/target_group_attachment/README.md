# resources/lb/target_group_attachment

Registers one or more targets (EC2 instances, IP addresses, or Lambda functions) against ALB target groups. Both the target group ARN and the target ID are dynamic values produced by other modules, so they are passed as plain inputs via Terragrunt `dependency` blocks rather than a `config_file` — a static YAML file cannot hold a Terragrunt dependency interpolation.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/target_group_attachment?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "target_group" {
  config_path = "../target_group"
}

dependency "bastion" {
  config_path = "../../ec2/bastion"
}

inputs = {
  target_group_attachments = {
    bastion_1 = {
      target_group_arn = dependency.target_group.outputs.target_groups["api"].arn
      target_id        = dependency.bastion.outputs.instances["main"].id
      port             = 8080
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `target_group_attachments` | Map of target group attachments to create (see fields below) | `map(object)` | — | yes |

### target_group_attachments fields

| Field | Description | Default |
|-------|-------------|---------|
| `target_group_arn` | ARN of the target group to attach the target to | required |
| `target_id` | ID of the target — instance ID, IP address, or Lambda ARN depending on the target group's `target_type` | required |
| `port` | Port on which the target receives traffic. Required unless the target group has a fixed port | `null` |
| `availability_zone` | Availability zone override, or `"all"` for IP targets outside the target group's VPC | `null` |

## Outputs

| Name | Description |
|------|-------------|
| `target_group_attachments` | Map of attachment key to `{ id, target_group_arn, target_id }` |
