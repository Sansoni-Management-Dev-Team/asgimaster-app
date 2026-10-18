resource "aws_ecs_service" "this" {
  for_each = var.services

  name            = "${var.project}-${each.key}-${var.environment}"
  cluster         = each.value.cluster_arn
  task_definition = each.value.task_definition_arn
  desired_count   = each.value.desired_count
  launch_type     = each.value.launch_type

  enable_execute_command = each.value.enable_execute_command

  deployment_minimum_healthy_percent = each.value.deployment_minimum_healthy_percent
  deployment_maximum_percent         = each.value.deployment_maximum_percent
  health_check_grace_period_seconds  = each.value.load_balancer != null ? each.value.health_check_grace_period_seconds : null

  network_configuration {
    subnets          = each.value.subnet_ids
    security_groups  = each.value.security_group_ids
    assign_public_ip = each.value.assign_public_ip
  }

  dynamic "load_balancer" {
    for_each = each.value.load_balancer != null ? [each.value.load_balancer] : []
    content {
      target_group_arn = load_balancer.value.target_group_arn
      container_name   = load_balancer.value.container_name
      container_port   = load_balancer.value.container_port
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })

  lifecycle {
    ignore_changes = [desired_count]
  }
}
