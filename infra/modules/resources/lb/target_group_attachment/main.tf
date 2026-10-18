resource "aws_lb_target_group_attachment" "this" {
  for_each = var.target_group_attachments

  target_group_arn  = each.value.target_group_arn
  target_id         = each.value.target_id
  port              = each.value.port
  availability_zone = each.value.availability_zone
}
