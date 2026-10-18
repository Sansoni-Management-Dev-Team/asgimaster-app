resource "aws_lb_listener_rule" "this" {
  for_each = var.listener_rules

  listener_arn = each.value.listener_arn
  priority     = each.value.priority

  action {
    type             = each.value.action.type
    target_group_arn = each.value.action.type == "forward" ? each.value.action.target_group_arn : null

    dynamic "redirect" {
      for_each = each.value.action.type == "redirect" ? [1] : []
      content {
        port        = try(each.value.action.redirect.port, "443")
        protocol    = try(each.value.action.redirect.protocol, "HTTPS")
        status_code = try(each.value.action.redirect.status_code, "HTTP_301")
        host        = try(each.value.action.redirect.host, "#{host}")
        path        = try(each.value.action.redirect.path, "/#{path}")
        query       = try(each.value.action.redirect.query, "#{query}")
      }
    }

    dynamic "fixed_response" {
      for_each = each.value.action.type == "fixed-response" ? [1] : []
      content {
        content_type = each.value.action.fixed_response.content_type
        message_body = try(each.value.action.fixed_response.message_body, null)
        status_code  = try(each.value.action.fixed_response.status_code, "200")
      }
    }
  }

  dynamic "condition" {
    for_each = each.value.conditions
    content {
      dynamic "path_pattern" {
        for_each = condition.value.type == "path-pattern" ? [condition.value] : []
        content {
          values = path_pattern.value.values
        }
      }

      dynamic "host_header" {
        for_each = condition.value.type == "host-header" ? [condition.value] : []
        content {
          values = host_header.value.values
        }
      }
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
