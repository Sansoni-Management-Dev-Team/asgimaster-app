locals {
  config  = yamldecode(file(var.config_file))
  brokers = local.config.brokers
}

# Admin usernames/passwords are never generated or stored by Terraform. A
# single secret (var.credentials_secret_id) holds every broker's credentials
# as flat JSON keys (e.g. MQ_USERNAME, MQ_PASSWORD, MQ_TEST_USERNAME, ...).
# Each broker picks its pair via username_key/password_key.
data "aws_secretsmanager_secret_version" "master" {
  secret_id = var.credentials_secret_id
}

locals {
  secret_values = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)
}

resource "aws_mq_broker" "this" {
  for_each = local.brokers

  broker_name        = "${var.project}-${each.key}-${var.environment}"
  engine_type        = "RabbitMQ"
  engine_version     = each.value.engine_version
  host_instance_type = each.value.host_instance_type
  deployment_mode    = try(each.value.deployment_mode, "SINGLE_INSTANCE")

  publicly_accessible        = try(each.value.publicly_accessible, false)
  auto_minor_version_upgrade = try(each.value.auto_minor_version_upgrade, true)
  apply_immediately          = try(each.value.apply_immediately, false)

  subnet_ids      = var.subnet_ids
  security_groups = var.security_group_ids

  encryption_options {
    kms_key_id        = var.kms_key_id
    use_aws_owned_key = false
  }

  # RabbitMQ brokers only accept a single admin user at creation time and do
  # not support console_access or groups (those are ActiveMQ-only fields).
  user {
    username = local.secret_values[each.value.username_key]
    password = local.secret_values[each.value.password_key]
  }

  # RabbitMQ does not support audit logging, only general logs.
  logs {
    general = try(each.value.general_logs, true)
  }

  maintenance_window_start_time {
    day_of_week = try(each.value.maintenance_day_of_week, "SUNDAY")
    time_of_day = try(each.value.maintenance_time_of_day, "03:00")
    time_zone   = try(each.value.maintenance_time_zone, "UTC")
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
