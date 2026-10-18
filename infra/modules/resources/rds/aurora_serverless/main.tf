locals {
  config   = yamldecode(file(var.config_file))
  clusters = local.config.clusters

  # Flatten instances per cluster so each gets a stable for_each key.
  cluster_instances = merge([
    for cluster_key, cluster in local.clusters : {
      for i in range(try(cluster.instances, 1)) :
      "${cluster_key}-${i}" => { cluster_key = cluster_key, index = i }
    }
  ]...)
}

# Master usernames/passwords are never generated or stored by Terraform. A
# single secret (var.credentials_secret_id) holds every cluster's credentials
# as flat JSON keys (e.g. DB_USERNAME, DB_PASSWORD, DB_TEST_USERNAME, ...).
# Each cluster picks its pair via username_key/password_key.
data "aws_secretsmanager_secret_version" "master" {
  secret_id = var.credentials_secret_id
}

locals {
  secret_values = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)

  # Family naming follows AWS's own convention: aurora-postgresql<major>
  # (e.g. aurora-postgresql16) and aurora-mysql<major.minor> (e.g. aurora-mysql8.0).
  cluster_parameter_group_family = {
    for key, cluster in local.clusters : key =>
    try(cluster.engine, "aurora-postgresql") == "aurora-postgresql" ?
    "aurora-postgresql${split(".", cluster.engine_version)[0]}" :
    "aurora-mysql${join(".", slice(split(".", cluster.engine_version), 0, 2))}"
  }

  # aurora-postgresql enforces TLS via rds.force_ssl; aurora-mysql via require_secure_transport.
  cluster_secure_transport_parameter = {
    for key, cluster in local.clusters : key =>
    try(cluster.engine, "aurora-postgresql") == "aurora-postgresql" ? "rds.force_ssl" : "require_secure_transport"
  }
}

resource "aws_rds_cluster_parameter_group" "this" {
  for_each = local.clusters

  name        = "${var.project}-${each.key}-${var.environment}"
  description = "Cluster parameter group for ${var.project}-${each.key}-${var.environment}"
  family      = local.cluster_parameter_group_family[each.key]

  parameter {
    name = local.cluster_secure_transport_parameter[each.key]
    # rds.force_ssl takes 1/0. require_secure_transport takes ON/OFF. A mismatch shows as a change on every plan.
    value = (local.cluster_secure_transport_parameter[each.key] == "rds.force_ssl"
      ? (try(each.value.require_secure_transport, true) ? "1" : "0")
    : (try(each.value.require_secure_transport, true) ? "ON" : "OFF"))
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_db_subnet_group" "this" {
  for_each = local.clusters

  name        = "${var.project}-${each.key}-${var.environment}"
  description = "Subnet group for ${var.project}-${each.key}-${var.environment}"
  subnet_ids  = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_rds_cluster" "this" {
  for_each = local.clusters

  cluster_identifier = "${var.project}-${each.key}-${var.environment}"
  engine             = try(each.value.engine, "aurora-postgresql")
  engine_version     = each.value.engine_version
  engine_mode        = "provisioned"
  database_name      = each.value.database_name
  master_username    = local.secret_values[each.value.username_key]
  master_password    = local.secret_values[each.value.password_key]

  storage_encrypted = true
  kms_key_id        = var.kms_key_id

  db_subnet_group_name            = aws_db_subnet_group.this[each.key].name
  vpc_security_group_ids          = var.security_group_ids
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this[each.key].name

  serverlessv2_scaling_configuration {
    min_capacity = try(each.value.min_capacity, 0.5)
    max_capacity = try(each.value.max_capacity, 8)
  }

  backup_retention_period = try(each.value.backup_retention_period, 7)
  deletion_protection     = try(each.value.deletion_protection, false)
  skip_final_snapshot     = try(each.value.skip_final_snapshot, true)
  final_snapshot_identifier = try(each.value.skip_final_snapshot, true) ? null : try(
    each.value.final_snapshot_identifier,
    "${var.project}-${each.key}-${var.environment}-final"
  )

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_rds_cluster_instance" "this" {
  for_each = local.cluster_instances

  identifier         = "${var.project}-${each.value.cluster_key}-${each.value.index}-${var.environment}"
  cluster_identifier = aws_rds_cluster.this[each.value.cluster_key].id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this[each.value.cluster_key].engine
  engine_version     = aws_rds_cluster.this[each.value.cluster_key].engine_version

  publicly_accessible = var.publicly_accessible

  tags = merge(var.tags, {
    Name = "${var.project}-${each.value.cluster_key}-${each.value.index}-${var.environment}"
  })
}
