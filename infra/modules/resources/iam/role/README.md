# resources/iam/role

Creates one or more IAM roles from a YAML config file. Each role requires a trust policy JSON file (assume role policy). Optionally attach inline policies — provided as a raw JSON string in the config or as a JSON filename resolved from the same `config/` directory — and attach managed policies by ARN. Trust policy and inline policy files are rendered with `templatefile()`, so they may reference `${region}`, `${aws_account}`, `${project}`, and `${environment}` placeholders, populated from `var.region`, the calling account's `aws_caller_identity`, `var.project`, and `var.environment`.

Managed policy ARNs can come from two places: a static list per role in `config.yml` (`managed_policy_arns`), and/or the `managed_policy_arns` Terraform variable, keyed by role key. The variable exists because `config_file` is static YAML — it can't reference a live value like a Terragrunt `dependency` output, so an ARN produced by another module (e.g. `resources/iam/permissions`) must be passed in through the variable instead. The two sources are merged per role.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/iam/role?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "permissions" {
  config_path = "../permissions"
}

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  managed_policy_arns = {
    ecs_task = [dependency.permissions.outputs.policies["s3_read"].arn]
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
roles:
  ecs_task:
    assume_role_policy: assume_role_policy.json
    name: custom-ecs-task-role
    inline_policies:
      task_permissions:
        policy_file: inline_policy.json
      extra_inline:
        policy_json: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"ssm:GetParameter","Resource":"*"}]}'
    managed_policy_arns:
      - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      # ARNs sourced from another module (e.g. resources/iam/permissions) go through
      # the `managed_policy_arns` Terraform variable instead, not this static list.
    tags:
      Component: ecs
  ecs_execution:
    assume_role_policy: assume_role_policy.json
    managed_policy_arns:
      - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### config/assume_role_policy.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### config/inline_policy.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "*"
    }
  ]
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for role names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `managed_policy_arns` | Map of role key to additional managed policy ARNs to attach, for ARNs sourced from a separate Terragrunt dependency (e.g. `resources/iam/permissions` outputs). Merged with each role's `config.yml` `managed_policy_arns` list | `map(list(string))` | `{}` | no |
| `tags` | Tags applied to all IAM roles | `map(string)` | `{}` | no |

### config.yml role fields

| Field | Description | Required |
|-------|-------------|----------|
| `assume_role_policy` | Filename of the trust policy JSON (resolved relative to the config file). Rendered with `templatefile()`; may reference `${region}`, `${aws_account}`, `${project}`, and `${environment}` | yes |
| `name` | Explicit role name. If empty or omitted, falls back to `"${project}-${role_key}-${environment}"` | no |
| `inline_policies` | Map of inline policy name to `{ policy_file }` or `{ policy_json }` | no |
| `managed_policy_arns` | List of managed policy ARNs to attach | no |
| `tags` | Per-role tags merged with the module-level `tags` variable | no |

### inline_policy fields

Exactly one of `policy_file` or `policy_json` must be provided per entry.

| Field | Description |
|-------|-------------|
| `policy_file` | Filename of the policy JSON (resolved relative to the config file). Rendered with `templatefile()`; may reference `${region}`, `${aws_account}`, `${project}`, and `${environment}` |
| `policy_json` | Raw JSON string of the policy document |

## Outputs

| Name | Description |
|------|-------------|
| `roles` | Map of role key to `{ arn, name, id }` |
