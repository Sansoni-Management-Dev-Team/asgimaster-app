# resources/mq/rabbitmq

Creates one or more Amazon MQ brokers running RabbitMQ (`aws_mq_broker`, `engine_type = "RabbitMQ"`). Storage is always encrypted with a customer-managed KMS key (see `resources/kms`).

Amazon MQ places some limits on RabbitMQ brokers that this module respects:

- Only one admin user can be created at broker creation time. Additional users must be created afterwards via the RabbitMQ management console/API — Terraform cannot manage them, and changing the `user` block forces broker recreation.
- Users cannot have `console_access` or `groups` (those fields are ActiveMQ-only).
- Audit logging is not supported; only `general` logs.
- `deployment_mode` is `SINGLE_INSTANCE` or `CLUSTER_MULTI_AZ`. Both take a single subnet — for `CLUSTER_MULTI_AZ`, Amazon MQ places the additional cluster nodes across other AZs in the same VPC automatically.

Credentials are never generated or managed by this module. A single Secrets Manager secret (`credentials_secret_id`) holds every broker's admin credentials as flat JSON keys — created and populated outside Terraform. Each broker in `config_file` picks its own pair via `username_key`/`password_key`, so one secret can back multiple brokers:

```json
{
  "MQ_USERNAME": "admin",
  "MQ_PASSWORD": "<generated>"
}
```

Subnet IDs, security group IDs, the KMS key ARN, and the credentials secret ID come from Terragrunt `dependency` blocks or plain inputs.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/mq/rabbitmq?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "sg" {
  config_path = "../sg"
}

dependency "kms" {
  config_path = "../kms"
}

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  subnet_ids            = [values(dependency.vpc.outputs.private_subnets)[0].id]
  security_group_ids    = [dependency.sg.outputs.security_groups["rabbitmq"].id]
  kms_key_id            = dependency.kms.outputs.keys["mq"].arn
  credentials_secret_id = "myapp/production/rabbitmq-admin"

  tags = {
    ManagedBy = "terraform"
  }
}
```

Before applying, create the shared credentials secret manually (e.g. via the AWS CLI or console — not Terraform):

```bash
aws secretsmanager create-secret \
  --name myapp/production/rabbitmq-admin \
  --secret-string '{
    "MQ_USERNAME": "admin",
    "MQ_PASSWORD": "<generated>"
  }'
```

### config/config.yml

```yaml
brokers:
  main:
    engine_version: "3.13"
    host_instance_type: mq.m5.large
    deployment_mode: CLUSTER_MULTI_AZ
    username_key: MQ_USERNAME
    password_key: MQ_PASSWORD
    publicly_accessible: false
    auto_minor_version_upgrade: true
    apply_immediately: false
    general_logs: true
    maintenance_day_of_week: SUNDAY
    maintenance_time_of_day: "03:00"
    maintenance_time_zone: UTC
  staging:
    engine_version: "3.13"
    host_instance_type: mq.t3.micro
    deployment_mode: SINGLE_INSTANCE
    username_key: MQ_USERNAME
    password_key: MQ_PASSWORD
    publicly_accessible: false
    auto_minor_version_upgrade: true
    apply_immediately: true
    general_logs: true
    maintenance_day_of_week: SUNDAY
    maintenance_time_of_day: "03:00"
    maintenance_time_zone: UTC
```

> `staging` above uses `deployment_mode: SINGLE_INSTANCE`, a good fit for non-production brokers where a single node is acceptable.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `subnet_ids` | Subnet IDs for the broker(s) — one subnet for `SINGLE_INSTANCE`, one subnet for `CLUSTER_MULTI_AZ` | `list(string)` | — | yes |
| `security_group_ids` | Security group IDs to associate with the broker(s) | `list(string)` | — | yes |
| `kms_key_id` | ARN of the KMS key used to encrypt broker storage (from `resources/kms`) | `string` | — | yes |
| `credentials_secret_id` | Name or ARN of the single manually-created Secrets Manager secret holding all brokers' credentials | `string` | — | yes |
| `tags` | Tags applied to all resources | `map(string)` | `{}` | no |

### config.yml brokers fields

| Field | Description | Default |
|-------|-------------|---------|
| `engine_version` | RabbitMQ engine version (e.g. `"3.13"`) | required |
| `host_instance_type` | Broker instance type (e.g. `mq.t3.micro`, `mq.m5.large`) | required |
| `deployment_mode` | `SINGLE_INSTANCE` or `CLUSTER_MULTI_AZ` | `"SINGLE_INSTANCE"` |
| `username_key` | Key within `credentials_secret_id`'s JSON holding this broker's admin username | required |
| `password_key` | Key within `credentials_secret_id`'s JSON holding this broker's admin password | required |
| `publicly_accessible` | Allow connections from outside the broker's VPC | `false` |
| `auto_minor_version_upgrade` | Automatically apply minor version upgrades during the maintenance window | `true` |
| `apply_immediately` | Apply changes immediately instead of waiting for the maintenance window | `false` |
| `general_logs` | Enable general logging to CloudWatch Logs | `true` |
| `maintenance_day_of_week` | Day of week for the maintenance window (e.g. `SUNDAY`) | `"SUNDAY"` |
| `maintenance_time_of_day` | Time of day for the maintenance window (`HH:MM`, UTC unless `maintenance_time_zone` overrides) | `"03:00"` |
| `maintenance_time_zone` | Time zone for the maintenance window | `"UTC"` |

## Outputs

| Name | Description |
|------|-------------|
| `brokers` | Map of broker key to `{ id, arn, endpoints, username_key }` |
