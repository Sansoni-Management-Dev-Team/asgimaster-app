output "accounts" {
  description = "Map of account key to account attributes."
  value = {
    for key, account in aws_organizations_account.this : key => {
      id  = account.id
      arn = account.arn
    }
  }
}
