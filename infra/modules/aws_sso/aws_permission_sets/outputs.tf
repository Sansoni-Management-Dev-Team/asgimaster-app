output "permission_sets" {
  description = "Map of permission set key to IAM Identity Center permission set attributes."
  value = {
    for key, ps in aws_ssoadmin_permission_set.this : key => {
      permission_set_arn = ps.arn
      name               = ps.name
    }
  }
}
