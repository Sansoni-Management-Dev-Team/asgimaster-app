# resources/ecr

Creates one or more ECR (Elastic Container Registry) repositories. Repository definitions and per-repository lifecycle policies are driven by a YAML config file, keeping the Terragrunt `inputs` block minimal. The config file references JSON policy files by filename — both files live together in the caller's `config/` directory.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ecr?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
```

### config/config.yml

```yaml
repositories:
  api:
    image_tag_mutability: IMMUTABLE
    force_delete: false
    scan_on_push: true
    policy: default.json
  worker:
    image_tag_mutability: MUTABLE
    force_delete: false
    scan_on_push: true
    policy: default.json
```

### config/default.json

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire untagged images older than 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Keep only the last 10 tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPatternList": ["*"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }
  ]
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `tags` | Tags applied to all repositories | `map(string)` | `{}` | no |

### config.yml repository fields

| Field | Description | Default |
|-------|-------------|---------|
| `image_tag_mutability` | `MUTABLE` or `IMMUTABLE` | `"MUTABLE"` |
| `force_delete` | Delete repo even when it contains images | `false` |
| `scan_on_push` | Enable vulnerability scanning on push | `true` |
| `policy` | Filename of the JSON lifecycle policy (resolved relative to the config file) | none |

## Outputs

| Name | Description |
|------|-------------|
| `repositories` | Map of repository key to `{ arn, registry_id, repository_url, name }` |
