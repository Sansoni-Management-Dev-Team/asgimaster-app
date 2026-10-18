# resources/ec2/sg

Creates one or more security groups with their ingress and egress rules. All rule definitions live in a YAML config file. Rules that reference another security group use `source_sg_key`, which resolves first against SGs created within this module (intra-module), then against `source_security_groups` input (cross-stack, from Terragrunt `dependency` blocks).

Rules use `aws_vpc_security_group_ingress_rule` and `aws_vpc_security_group_egress_rule` (separate resources, not inline) so that SGs referencing each other can be created in the same module without cycles.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ec2/sg?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "vpc" {
  config_path = "../vpc"
}

# Only needed if rules reference SGs from another stack
dependency "other_sg" {
  config_path = "../other_sg"
}

inputs = {
  project     = "myapp"
  environment = "production"
  vpc_id      = dependency.vpc.outputs.vpc_id
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  # Expose external SGs so rules can reference them by key
  source_security_groups = {
    bastion = dependency.other_sg.outputs.security_groups["bastion"].id
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

Rules are **maps** (not lists) so that adding or removing a rule never affects the state of other rules.

```yaml
security_groups:
  alb:
    description: "ALB security group"
    ingress:
      http_internet:
        description: "Allow HTTP from internet"
        from_port: 80
        to_port: 80
        protocol: tcp
        cidr_ipv4: "0.0.0.0/0"
      https_internet:
        description: "Allow HTTPS from internet"
        from_port: 443
        to_port: 443
        protocol: tcp
        cidr_ipv4: "0.0.0.0/0"
    egress:
      all_outbound:
        description: "Allow all outbound traffic"
        protocol: "-1"
        cidr_ipv4: "0.0.0.0/0"

  app:
    description: "App security group"
    ingress:
      from_alb:
        description: "Allow from ALB on app port"
        from_port: 8080
        to_port: 8080
        protocol: tcp
        source_sg_key: alb          # intra-module: references the "alb" SG above
      from_bastion:
        description: "Allow SSH from bastion"
        from_port: 22
        to_port: 22
        protocol: tcp
        source_sg_key: bastion      # cross-stack: resolved via source_security_groups input
    egress:
      all_outbound:
        description: "Allow all outbound traffic"
        protocol: "-1"
        cidr_ipv4: "0.0.0.0/0"
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `vpc_id` | ID of the VPC to create security groups in | `string` | — | yes |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `source_security_groups` | Map of logical key to SG ID for external security groups | `map(string)` | `{}` | no |
| `tags` | Tags applied to all security groups | `map(string)` | `{}` | no |

### config.yml security_groups fields

| Field | Description |
|-------|-------------|
| `description` | Security group description |
| `ingress` | Map of ingress rules (key = stable rule name) |
| `egress` | Map of egress rules (key = stable rule name) |

### Rule fields

| Field | Description |
|-------|-------------|
| `description` | Rule description |
| `protocol` | IP protocol (`tcp`, `udp`, `icmp`, `"-1"` for all) |
| `from_port` | Start of port range (omit when protocol is `-1`) |
| `to_port` | End of port range (omit when protocol is `-1`) |
| `cidr_ipv4` | Source/destination IPv4 CIDR (mutually exclusive with `source_sg_key`) |
| `source_sg_key` | Logical key of the source SG — resolved against this module's SGs first, then `source_security_groups` |

## Outputs

| Name | Description |
|------|-------------|
| `security_groups` | Map of SG key to `{ id, arn, name }` |
