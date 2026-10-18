output "target_groups" {
  description = "Map of target group key to target group attributes."
  value = {
    for key, tg in aws_lb_target_group.this : key => {
      arn  = tg.arn
      name = tg.name
    }
  }
}
