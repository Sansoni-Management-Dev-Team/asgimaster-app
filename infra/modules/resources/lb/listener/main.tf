resource "aws_lb_listener" "this" {
  for_each = var.listeners

  load_balancer_arn = each.value.load_balancer_arn
  port              = each.value.port
  protocol          = each.value.protocol
  ssl_policy        = each.value.protocol == "HTTPS" ? each.value.ssl_policy : null
  certificate_arn   = each.value.protocol == "HTTPS" ? each.value.certificate_arn : null

  default_action {
    type             = each.value.default_action.type
    target_group_arn = each.value.default_action.type == "forward" ? each.value.default_action.target_group_arn : null

    dynamic "redirect" {
      for_each = each.value.default_action.type == "redirect" ? [1] : []
      content {
        port        = try(each.value.default_action.redirect.port, "443")
        protocol    = try(each.value.default_action.redirect.protocol, "HTTPS")
        status_code = try(each.value.default_action.redirect.status_code, "HTTP_301")
      }
    }

    dynamic "fixed_response" {
      for_each = each.value.default_action.type == "fixed-response" ? [1] : []
      content {
        content_type = each.value.default_action.fixed_response.content_type
        message_body = try(each.value.default_action.fixed_response.message_body, null)
        status_code  = try(each.value.default_action.fixed_response.status_code, "200")
      }
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
