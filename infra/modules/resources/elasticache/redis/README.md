# resources/elasticache/redis

Creates one or more ElastiCache replication groups, Redis OSS or Valkey. Uses `aws_elasticache_replication_group` (not `aws_elasticache_cluster`, which is Memcached-only). Encryption at rest and in transit are enabled by default. `automatic_failover_enabled` is derived automatically — it is enabled when `num_cache_clusters >= 2`.

> **Engine versions**: Redis OSS and Valkey use independent version numbers (e.g. Redis `7.1` vs. Valkey `7.2`/`8.0`). Make sure `engine_version` matches whichever `engine` is set.

Subnet IDs and security group IDs come from Terragrunt `dependency` blocks.

> **Naming limit**: `replication_group_id` is capped at 40 characters. Keep `project`, cluster key, and `environment` short.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/elasticache/redis?ref=v0.0.1"
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
clusters:
  cache:
    description: "Redis cache cluster"
    engine: valkey
    node_type: cache.t3.micro
    num_cache_clusters: 1
    engine_version: "7.2"
    port: 6379
    at_rest_encryption_enabled: true
    transit_encryption_enabled: true
    snapshot_retention_limit: 1
```

> Set `num_cache_clusters: 2` for a primary + one replica. `automatic_failover_enabled` is set to `true` automatically when `num_cache_clusters >= 2`.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `subnet_ids` | Subnet IDs for the ElastiCache subnet group (min 2, across AZs) | `list(string)` | — | yes |
| `security_group_ids` | Security group IDs to associate with the replication group | `list(string)` | — | yes |
| `tags` | Tags applied to all resources | `map(string)` | `{}` | no |

### config.yml clusters fields

| Field | Description | Default |
|-------|-------------|---------|
| `description` | Human-readable description of the replication group | `"<project> <key> Redis"` |
| `engine` | Cache engine: `"redis"` or `"valkey"` | `"redis"` |
| `node_type` | ElastiCache node type (e.g. `cache.t3.micro`, `cache.r7g.large`) | required |
| `num_cache_clusters` | Total number of nodes (1 = primary only, 2+ = primary + replicas) | `1` |
| `engine_version` | Engine version, matching `engine` (e.g. `"7.1"` for Redis, `"7.2"` for Valkey) | required |
| `port` | Redis port | `6379` |
| `at_rest_encryption_enabled` | Enable encryption at rest | `true` |
| `transit_encryption_enabled` | Enable in-transit encryption (TLS) | `true` |
| `snapshot_retention_limit` | Days to retain daily snapshots (0 = disabled) | `1` |

## Outputs

| Name | Description |
|------|-------------|
| `clusters` | Map of cluster key to `{ id, arn, primary_endpoint_address, reader_endpoint_address, port }` |
