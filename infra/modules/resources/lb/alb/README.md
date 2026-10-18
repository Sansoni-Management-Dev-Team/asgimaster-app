# resources/lb/alb

Creates one or more Application Load Balancers. Each ALB is internet-facing by default. Security groups and subnets come from Terragrunt `dependency` blocks, keeping networking concerns out of this module.

## Sample Terragrunt Usage

### Internet-facing ALB

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/alb?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "sg" {
  config_path = "../security_group"
}

inputs = {
  project     = "myapp"
  environment = "production"

  load_balancers = {
    public = {
      internal           = false
      security_group_ids = [dependency.sg.outputs.security_groups["alb"].id]
      subnet_ids         = values(dependency.subnet.outputs.public_subnets)[*].id
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### Internal ALB

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/alb?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "sg" {
  config_path = "../security_group"
}

inputs = {
  project     = "myapp"
  environment = "production"

  load_balancers = {
    internal = {
      internal           = true
      security_group_ids = [dependency.sg.outputs.security_groups["alb-internal"].id]
      subnet_ids         = values(dependency.subnet.outputs.private_subnets)[*].id
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `tags` | Tags applied to all load balancers | `map(string)` | `{}` | no |
| `load_balancers` | Map of ALBs to create (see fields below) | `map(object)` | — | yes |

### load_balancers fields

| Field | Description | Default |
|-------|-------------|---------|
| `internal` | Whether the ALB is internal (private) | `false` |
| `security_group_ids` | List of security group IDs to attach | required |
| `subnet_ids` | List of subnet IDs (minimum 2, across AZs) | required |
| `enable_deletion_protection` | Prevent accidental deletion | `false` |
| `tags` | Per-ALB tags merged with module-level tags | `{}` |

## Outputs

| Name | Description |
|------|-------------|
| `load_balancers` | Map of ALB key to `{ arn, dns_name, zone_id, name }` |
