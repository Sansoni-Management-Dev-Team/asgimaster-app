resource "aws_identitystore_group" "this" {
  for_each = var.groups

  identity_store_id = var.identity_store_id
  display_name      = each.value.display_name
  description       = each.value.description
}
