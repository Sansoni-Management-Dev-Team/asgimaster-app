output "memberships" {
  description = "Map of flattened membership key (group_key:user_id) to IAM Identity Center group membership attributes."
  value = {
    for key, membership in aws_identitystore_group_membership.this : key => {
      membership_id = membership.membership_id
      group_id      = membership.group_id
      user_id       = membership.member_id
    }
  }
}
