locals {
  policy_attachments = merge([
    for user_key, user in var.users : {
      for arn in user.managed_policy_arns :
      "${user_key}:${arn}" => {
        user_key   = user_key
        policy_arn = arn
      }
    }
  ]...)

  users_with_groups = {
    for user_key, user in var.users : user_key => user
    if length(user.groups) > 0
  }
}

resource "aws_iam_user" "this" {
  for_each = var.users

  name                 = each.key
  path                 = each.value.path
  permissions_boundary = each.value.permissions_boundary
  tags                 = each.value.tags
}

resource "aws_iam_user_policy_attachment" "this" {
  for_each = local.policy_attachments

  user       = aws_iam_user.this[each.value.user_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_user_group_membership" "this" {
  for_each = local.users_with_groups

  user   = aws_iam_user.this[each.key].name
  groups = each.value.groups
}
