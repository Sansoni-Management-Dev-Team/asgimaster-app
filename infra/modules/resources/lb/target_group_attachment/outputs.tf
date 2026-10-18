output "target_group_attachments" {
  description = "Map of attachment key to attachment attributes."
  value = {
    for key, attachment in aws_lb_target_group_attachment.this : key => {
      id               = attachment.id
      target_group_arn = attachment.target_group_arn
      target_id        = attachment.target_id
    }
  }
}
