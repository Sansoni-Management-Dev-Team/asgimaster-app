# resources/iam/permissions

Creates one or more IAM managed policies from a YAML config file. Policy documents can be supplied as a raw JSON string directly in the config or as a JSON filename resolved from the same `config/` directory. Policy files are rendered with `templatefile()`, so they may reference `${region}`, `${aws_account}`, `${project}`, and `${environment}` placeholders, populated from `var.region`, the calling account's `aws_caller_identity`, `var.project`, and `var.environment`. Outputs policy ARNs for consumption by `resources/iam/role` or any other module that attaches managed policies.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/iam/permissions?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
policies:
  s3_read:
    description: "Grants read access to S3 buckets."
    policy_file: s3_read.json
    tags:
      Component: storage
  ssm_params:
    description: "Grants read access to SSM Parameter Store."
    policy_json: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters"],"Resource":"*"}]}'
  rds_connect:
    description: "Grants RDS IAM authentication connect access."
    policy_file: rds_connect.json
    tags:
      Component: database
```

### config/s3_read.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": "*"
    }
  ]
}
```

### config/rds_connect.json

`policy_file` entries are rendered with `templatefile()`, so `${region}` and `${aws_account}` are substituted automatically:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowRDSIAMConnect",
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:${region}:${aws_account}:dbuser:DB_RESOURCE_ID/DB_USERNAME"
    }
  ]
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for policy names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `tags` | Tags applied to all IAM policies | `map(string)` | `{}` | no |

### config.yml policy fields

Exactly one of `policy_file` or `policy_json` must be provided per entry.

| Field | Description | Required |
|-------|-------------|----------|
| `description` | Human-readable policy description | no |
| `policy_file` | Filename of the policy JSON (resolved relative to the config file). Rendered with `templatefile()`; may reference `${region}`, `${aws_account}`, `${project}`, and `${environment}` | one of |
| `policy_json` | Raw JSON string of the policy document | one of |
| `tags` | Per-policy tags merged with the module-level `tags` variable | no |

## Outputs

| Name | Description |
|------|-------------|
| `policies` | Map of policy key to `{ arn, name, id }` |
