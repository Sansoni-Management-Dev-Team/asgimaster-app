# resources/lb/target_group

Creates one or more ALB target groups. Health check configuration is driven by a YAML config file, keeping the Terragrunt `inputs` block minimal. Intended for use with ECS — defaults `target_type` to `ip`. The VPC ID comes from a Terragrunt `dependency` block.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/target_group?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  project     = "myapp"
  environment = "production"
  vpc_id      = dependency.vpc.outputs.vpc_id
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
target_groups:
  api:
    port: 8080
    protocol: HTTP
    target_type: ip
    health_check:
      path: /health
      port: traffic-port
      healthy_threshold: 3
      unhealthy_threshold: 3
      timeout: 5
      interval: 30
      matcher: "200"
  worker:
    port: 9000
    protocol: HTTP
    target_type: ip
    health_check:
      path: /ping
      healthy_threshold: 2
      unhealthy_threshold: 5
      interval: 60
      matcher: "200-299"
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `vpc_id` | ID of the VPC to associate target groups with | `string` | — | yes |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `tags` | Tags applied to all target groups | `map(string)` | `{}` | no |

### config.yml target_groups fields

| Field | Description | Default |
|-------|-------------|---------|
| `port` | Port the target listens on | required |
| `protocol` | Protocol (`HTTP`, `HTTPS`) | required |
| `target_type` | `ip`, `instance`, or `lambda` | `"ip"` |
| `health_check.path` | Health check path | `"/"` |
| `health_check.port` | Health check port | `"traffic-port"` |
| `health_check.healthy_threshold` | Consecutive successes to mark healthy | `3` |
| `health_check.unhealthy_threshold` | Consecutive failures to mark unhealthy | `3` |
| `health_check.timeout` | Health check timeout in seconds | `5` |
| `health_check.interval` | Seconds between health checks | `30` |
| `health_check.matcher` | Success HTTP codes (e.g. `"200"`, `"200-299"`) | `"200"` |

## Outputs

| Name | Description |
|------|-------------|
| `target_groups` | Map of target group key to `{ arn, name }` |
