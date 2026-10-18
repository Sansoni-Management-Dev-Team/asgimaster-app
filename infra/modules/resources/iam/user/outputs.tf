output "users" {
  description = "Map of user key to IAM user attributes."
  value = {
    for key, user in aws_iam_user.this : key => {
      arn  = user.arn
      name = user.name
      id   = user.unique_id
    }
  }
}
