locals {
  config           = yamldecode(file(var.config_file))
  config_dir       = dirname(var.config_file)
  task_definitions = local.config.task_definitions
}

data "aws_caller_identity" "this" {}

resource "aws_ecs_task_definition" "this" {
  for_each = local.task_definitions

  family                   = "${var.project}-${each.key}-${var.environment}"
  network_mode             = try(each.value.network_mode, "awsvpc")
  requires_compatibilities = try(each.value.requires_compatibilities, ["FARGATE"])
  cpu                      = try(each.value.cpu, 256)
  memory                   = try(each.value.memory, 512)
  execution_role_arn       = var.execution_role_arns[each.key]
  task_role_arn            = try(var.task_role_arns[each.key], null)

  container_definitions = templatefile(
    "${local.config_dir}/${each.value.container_definitions}",
    {
      name          = each.key
      region        = var.region
      project       = var.project
      environment   = var.environment
      aws_account   = data.aws_caller_identity.this.account_id
      log_group     = "/ecs/${var.project}-${each.key}-${var.environment}"
      secret_suffix = var.secret_suffix
    }
  )

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
