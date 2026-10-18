output "roles" {
  description = "Map of role key to role attributes."
  value = {
    for key, role in aws_iam_role.this : key => {
      arn  = role.arn
      name = role.name
      id   = role.id
    }
  }
}
