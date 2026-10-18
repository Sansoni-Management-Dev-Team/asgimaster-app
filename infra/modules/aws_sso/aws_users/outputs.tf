output "users" {
  description = "Map of user key to IAM Identity Center user attributes."
  value = {
    for key, user in aws_identitystore_user.this : key => {
      user_id  = user.user_id
      user_name = user.user_name
    }
  }
}
