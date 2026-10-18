locals {
  flat_memberships = {
    for pair in flatten([
      for group_key, group in var.memberships : [
        for user_id in group.users : {
          key      = "${group_key}:${user_id}"
          group_id = group.group_id
          user_id  = user_id
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_identitystore_group_membership" "this" {
  for_each = local.flat_memberships

  identity_store_id = var.identity_store_id
  group_id          = each.value.group_id
  member_id         = each.value.user_id
}
