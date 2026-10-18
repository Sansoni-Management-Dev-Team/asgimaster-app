locals {
  config        = yamldecode(file(var.config_file))
  target_groups = local.config.target_groups
}

resource "aws_lb_target_group" "this" {
  for_each = local.target_groups

  name        = "${var.project}-${each.key}-${var.environment}"
  port        = each.value.port
  protocol    = each.value.protocol
  vpc_id      = var.vpc_id
  target_type = try(each.value.target_type, "ip")

  health_check {
    path                = try(each.value.health_check.path, "/")
    port                = try(each.value.health_check.port, "traffic-port")
    healthy_threshold   = try(each.value.health_check.healthy_threshold, 3)
    unhealthy_threshold = try(each.value.health_check.unhealthy_threshold, 3)
    timeout             = try(each.value.health_check.timeout, 5)
    interval            = try(each.value.health_check.interval, 30)
    matcher             = try(each.value.health_check.matcher, "200")
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })

  lifecycle {
    create_before_destroy = true
  }
}
