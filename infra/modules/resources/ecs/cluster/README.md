# resources/ecs/cluster

Creates one or more ECS clusters. Supports enabling CloudWatch Container Insights per cluster.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ecs/cluster?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"

  clusters = {
    main = {
      container_insights = "enabled"
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
| `tags` | Tags applied to all clusters | `map(string)` | `{}` | no |
| `clusters` | Map of ECS clusters to create (see fields below) | `map(object)` | — | yes |

### clusters fields

| Field | Description | Default |
|-------|-------------|---------|
| `container_insights` | Enable CloudWatch Container Insights (`"enabled"` or `"disabled"`) | `"disabled"` |
| `tags` | Per-cluster tags merged with module-level tags | `{}` |

## Outputs

| Name | Description |
|------|-------------|
| `clusters` | Map of cluster key to `{ arn, name, id }` |
