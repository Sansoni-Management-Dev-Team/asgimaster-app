resource "aws_cloudwatch_log_group" "this" {
  for_each = var.log_groups

  name              = "${each.value.prefix}${var.project}-${each.value.name}-${var.environment}"
  retention_in_days = each.value.retention_in_days
  kms_key_id        = each.value.kms_key_id

  tags = merge(var.tags, each.value.tags, {
    Name = "${each.value.prefix}${var.project}-${each.value.name}-${var.environment}"
  })
}
