locals {
  config   = yamldecode(file(var.config_file))
  clusters = local.config.clusters
}

resource "aws_elasticache_subnet_group" "this" {
  for_each = local.clusters

  name        = "${var.project}-${each.key}-${var.environment}"
  description = "Subnet group for ${var.project}-${each.key}-${var.environment} Redis"
  subnet_ids  = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_elasticache_replication_group" "this" {
  for_each = local.clusters

  replication_group_id = "${var.project}-${each.key}-${var.environment}"
  description          = try(each.value.description, "${var.project} ${each.key} Redis")

  engine             = try(each.value.engine, "redis")
  node_type          = each.value.node_type
  num_cache_clusters = try(each.value.num_cache_clusters, 1)
  engine_version     = each.value.engine_version
  port               = try(each.value.port, 6379)

  subnet_group_name  = aws_elasticache_subnet_group.this[each.key].name
  security_group_ids = var.security_group_ids

  at_rest_encryption_enabled = try(each.value.at_rest_encryption_enabled, true)
  transit_encryption_enabled = try(each.value.transit_encryption_enabled, true)

  # Failover requires at least 2 nodes.
  automatic_failover_enabled = try(each.value.num_cache_clusters, 1) >= 2 ? true : false

  snapshot_retention_limit = try(each.value.snapshot_retention_limit, 1)

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
