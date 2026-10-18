# resources/kms

Creates one or more customer-managed KMS keys, each with an alias. Use this to get a key ARN for encrypting resources in other modules (e.g. RDS storage encryption) via Terragrunt `dependency` blocks — this module never calls other modules directly.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/kms?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"

  keys = {
    rds = {
      description = "CMK for myapp production RDS encryption"
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

Another module then consumes the key via a `dependency` block:

```hcl
dependency "kms" {
  config_path = "../kms"
}

inputs = {
  kms_key_id = dependency.kms.outputs.keys["rds"].arn
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `keys` | Map of KMS keys to create. The key is used as a unique identifier and forms the alias name | `map(object({...}))` | — | yes |
| `tags` | Tags applied to all resources | `map(string)` | `{}` | no |

### `keys` object fields

| Field | Description | Default |
|-------|-------------|---------|
| `description` | Description of the key's purpose | required |
| `deletion_window_in_days` | Waiting period before deletion (7–30) | `30` |
| `enable_key_rotation` | Enable automatic annual key rotation | `true` |
| `policy` | Key policy JSON. Leave unset to use the default IAM-controlled policy | `null` |
| `tags` | Additional tags for this specific key, merged with `var.tags` | `{}` |

## Outputs

| Name | Description |
|------|-------------|
| `keys` | Map of key identifier to `{ key_id, arn, alias_name, alias_arn }` |
