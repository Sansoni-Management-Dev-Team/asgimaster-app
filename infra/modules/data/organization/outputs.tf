output "root_id" {
  description = "Root ID of the AWS Organization."
  value       = data.aws_organizations_organization.this.roots[0].id
}

output "organization_id" {
  description = "ID of the AWS Organization."
  value       = data.aws_organizations_organization.this.id
}

output "master_account_id" {
  description = "Account ID of the management (master) account."
  value       = data.aws_organizations_organization.this.master_account_id
}
