output "groups" {
  description = "Map of group key to IAM Identity Center group attributes."
  value = {
    for key, group in aws_identitystore_group.this : key => {
      group_id     = group.group_id
      display_name = group.display_name
    }
  }
}
