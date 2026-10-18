locals {
  assignments = merge([
    for key, assignment in var.assignments : {
      for account_id in assignment.accounts : "${key}-${account_id}" => {
        group_id           = assignment.group_id
        account_id         = account_id
        permission_set_arn = assignment.permission_set_arn
      }
    }
  ]...)
}

resource "aws_ssoadmin_account_assignment" "this" {
  for_each = local.assignments

  instance_arn       = var.instance_arn
  permission_set_arn = each.value.permission_set_arn

  target_id   = each.value.account_id
  target_type = "AWS_ACCOUNT"

  principal_id   = each.value.group_id
  principal_type = "GROUP"
}
