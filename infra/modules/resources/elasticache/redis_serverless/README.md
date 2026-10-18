# resources/elasticache/redis_serverless

Creates one or more ElastiCache Serverless caches (Redis OSS or Valkey) using `aws_elasticache_serverless_cache`. Unlike [`resources/elasticache/redis`](../redis), there is no `node_type` to size — scaling is defined by `cache_usage_limits` (data storage and ECPUs), and AWS scales the cache automatically within those bounds.

> **Engine versions**: `major_engine_version` follows whichever `engine` is set (e.g. Redis OSS `"7"` vs. Valkey `"7"`/`"8"`/`"9"`). Use the AWS CLI `describe-cache-engine-versions` to confirm what's currently supported.

Subnet IDs and security group IDs come from Terragrunt `dependency` blocks.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/elasticache/redis_serverless?ref=v0.0.1"
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

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  subnet_ids         = values(dependency.vpc.outputs.private_subnets)[*].id
  security_group_ids = [dependency.sg.outputs.security_groups["redis"].id]

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
caches:
  cache:
    description: "Serverless Valkey cache"
    engine: valkey
    major_engine_version: "9"
    data_storage_max: 10
    data_storage_unit: GB
    ecpu_per_second_max: 5000
    daily_snapshot_time: "09:00"
    snapshot_retention_limit: 1
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Path to the YAML config file | `string` | — | yes |
| `subnet_ids` | Subnet IDs for the serverless cache VPC endpoint (same VPC) | `list(string)` | — | yes |
| `security_group_ids` | Security group IDs to associate with the serverless cache VPC endpoint | `list(string)` | — | yes |
| `tags` | Tags applied to all resources | `map(string)` | `{}` | no |

### config.yml caches fields

| Field | Description | Default |
|-------|-------------|---------|
| `description` | Human-readable description of the cache | `"<project> <key> Redis"` |
| `engine` | Cache engine: `"redis"` or `"valkey"` | `"redis"` |
| `major_engine_version` | Major engine version, matching `engine` (e.g. `"7"` for Redis, `"9"` for Valkey) | required |
| `data_storage_min` | Lower bound for data storage scaling, in `data_storage_unit` (1-5000) | unset (AWS default) |
| `data_storage_max` | Upper bound for data storage scaling, in `data_storage_unit` (1-5000) | required |
| `data_storage_unit` | Unit for data storage limits | `"GB"` |
| `ecpu_per_second_min` | Lower bound for ECPU/s scaling (1,000-15,000,000) | unset (AWS default) |
| `ecpu_per_second_max` | Upper bound for ECPU/s scaling (1,000-15,000,000) | required |
| `daily_snapshot_time` | UTC time (`HH:MM`) daily snapshots are taken | AWS default |
| `snapshot_retention_limit` | Days to retain daily snapshots (max 35) | `1` |
| `kms_key_id` | ARN of a customer-managed KMS key for encryption at rest | unset (AWS-managed key) |

## Outputs

| Name | Description |
|------|-------------|
| `caches` | Map of cache key to `{ id, arn, endpoint, status }` |
