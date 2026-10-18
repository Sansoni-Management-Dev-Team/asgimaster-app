locals {
  config = yamldecode(file(var.config_file))
  caches = local.config.caches
}

resource "aws_elasticache_serverless_cache" "this" {
  for_each = local.caches

  name        = "${var.project}-${each.key}-${var.environment}"
  description = try(each.value.description, "${var.project} ${each.key} Redis")

  engine               = try(each.value.engine, "redis")
  major_engine_version = each.value.major_engine_version

  cache_usage_limits {
    data_storage {
      minimum = try(each.value.data_storage_min, null)
      maximum = each.value.data_storage_max
      unit    = try(each.value.data_storage_unit, "GB")
    }

    ecpu_per_second {
      minimum = try(each.value.ecpu_per_second_min, null)
      maximum = each.value.ecpu_per_second_max
    }
  }

  daily_snapshot_time      = try(each.value.daily_snapshot_time, null)
  snapshot_retention_limit = try(each.value.snapshot_retention_limit, 1)

  kms_key_id = try(each.value.kms_key_id, null)

  subnet_ids         = var.subnet_ids
  security_group_ids = var.security_group_ids

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
