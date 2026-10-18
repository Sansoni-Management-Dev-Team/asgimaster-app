output "assignments" {
  description = "Map of assignment key (\"<key>-<account_id>\") to IAM Identity Center account assignment attributes."
  value = {
    for key, assignment in aws_ssoadmin_account_assignment.this : key => {
      account_id         = assignment.target_id
      group_id           = assignment.principal_id
      permission_set_arn = assignment.permission_set_arn
    }
  }
}
