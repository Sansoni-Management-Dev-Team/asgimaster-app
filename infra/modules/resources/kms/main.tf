resource "aws_kms_key" "this" {
  for_each = var.keys

  description             = each.value.description
  deletion_window_in_days = each.value.deletion_window_in_days
  enable_key_rotation     = each.value.enable_key_rotation
  policy                  = each.value.policy

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_kms_alias" "this" {
  for_each = var.keys

  name          = "alias/${var.project}-${each.key}-${var.environment}"
  target_key_id = aws_kms_key.this[each.key].key_id
}
