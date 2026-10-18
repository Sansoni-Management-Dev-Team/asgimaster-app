# resources/cloudwatch/log_group

Creates one or more CloudWatch log groups. Use this to provision log destinations for ECS tasks, Lambda functions, or any other service that writes logs to CloudWatch.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/cloudwatch/log_group?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"

  log_groups = {
    api = {
      name              = "api"
      prefix            = "/ecs/"
      retention_in_days = 14
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
| `tags` | Tags applied to all CloudWatch log groups | `map(string)` | `{}` | no |
| `log_groups` | Map of CloudWatch log groups to create (see fields below) | `map(object)` | — | yes |

### log_groups fields

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Name suffix used to build the log group name (`<prefix><project>-<name>-<environment>`) | required |
| `prefix` | Prefix prepended to the log group name (e.g. `"/ecs/"`) | `""` |
| `retention_in_days` | Number of days to retain log events | `30` |
| `kms_key_id` | ARN of the KMS key to encrypt log data | `null` |
| `tags` | Additional tags merged onto this log group | `{}` |

## Outputs

| Name | Description |
|------|-------------|
| `log_groups` | Map of log group key to `{ arn, name }` |
