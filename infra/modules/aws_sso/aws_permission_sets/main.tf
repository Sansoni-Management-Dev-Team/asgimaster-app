resource "aws_ssoadmin_permission_set" "this" {
  for_each = var.permission_sets

  instance_arn     = var.instance_arn
  name             = each.value.name
  description      = each.value.description
  session_duration = each.value.session_duration

  tags = var.tags
}

locals {
  policy_attachments = {
    for pair in flatten([
      for ps_key, ps in var.permission_sets : [
        for policy_arn in ps.managed_policies : {
          key        = "${ps_key}:${policy_arn}"
          ps_key     = ps_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_ssoadmin_managed_policy_attachment" "this" {
  for_each = local.policy_attachments

  instance_arn       = var.instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.ps_key].arn
  managed_policy_arn = each.value.policy_arn
}
