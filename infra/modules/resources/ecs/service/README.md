# resources/ecs/service

Creates one or more ECS services. All inputs (cluster ARN, task definition ARN, subnet IDs, security group IDs, target group ARN) come from Terragrunt `dependency` blocks. Supports optional ALB integration via the `load_balancer` block.

`desired_count` is ignored after initial creation (`lifecycle.ignore_changes`) so that auto-scaling can manage it without Terraform reverting the count on the next apply.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ecs/service?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "cluster" {
  config_path = "../cluster"
}

dependency "task_definition" {
  config_path = "../task_definition"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "sg" {
  config_path = "../sg"
}

dependency "target_group" {
  config_path = "../target_group"
}

inputs = {
  project     = "myapp"
  environment = "production"

  services = {
    api = {
      cluster_arn         = dependency.cluster.outputs.clusters["main"].arn
      task_definition_arn = dependency.task_definition.outputs.task_definitions["app"].arn
      desired_count       = 2
      subnet_ids          = values(dependency.subnet.outputs.private_subnets)[*].id
      security_group_ids  = [dependency.sg.outputs.security_groups["app"].id]

      load_balancer = {
        target_group_arn = dependency.target_group.outputs.target_groups["api"].arn
        container_name   = "app"
        container_port   = 80
      }
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
| `tags` | Tags applied to all ECS services | `map(string)` | `{}` | no |
| `services` | Map of ECS services to create (see fields below) | `map(object)` | — | yes |

### services fields

| Field | Description | Default |
|-------|-------------|---------|
| `cluster_arn` | ARN of the ECS cluster to run the service in | required |
| `task_definition_arn` | ARN of the task definition (including revision) | required |
| `desired_count` | Initial number of tasks (ignored after first apply — managed by auto-scaling) | `1` |
| `launch_type` | `"FARGATE"` or `"EC2"` | `"FARGATE"` |
| `subnet_ids` | Subnets to place tasks in (typically private) | required |
| `security_group_ids` | Security groups to attach to tasks | required |
| `assign_public_ip` | Assign a public IP to tasks | `false` |
| `enable_execute_command` | Enable ECS Exec for tasks in the service | `true` |
| `deployment_minimum_healthy_percent` | Minimum healthy task percentage during deployment | `100` |
| `deployment_maximum_percent` | Maximum task percentage during deployment | `200` |
| `health_check_grace_period_seconds` | Seconds to ignore health checks after task start (requires `load_balancer`) | `60` |
| `load_balancer.target_group_arn` | ARN of the ALB target group | — |
| `load_balancer.container_name` | Name of the container to register with the target group | — |
| `load_balancer.container_port` | Port on the container to register | — |

## Outputs

| Name | Description |
|------|-------------|
| `services` | Map of service key to `{ id, name }` |
