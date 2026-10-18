resource "aws_organizations_account" "this" {
  for_each = var.accounts

  name      = each.value.name
  email     = each.value.email
  role_name = each.value.role_name
  parent_id = each.value.parent_id
  tags      = each.value.tags

  lifecycle {
    ignore_changes = [role_name]
  }
}