output "accounts" {
  description = "Map of account name to account attributes."
  value = {
    for account in data.aws_organizations_organizational_unit_descendant_accounts.this.accounts : account.name => {
      id  = account.id
      arn = account.arn
    }
  }
}
