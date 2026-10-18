output "listener_rules" {
  description = "Map of listener rule key to listener rule attributes."
  value = {
    for key, rule in aws_lb_listener_rule.this : key => {
      arn      = rule.arn
      priority = rule.priority
    }
  }
}
