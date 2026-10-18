output "organizational_units" {
  description = "Map of OU name to organizational unit attributes."
  value = {
    for name, ou in aws_organizations_organizational_unit.this : name => {
      id  = ou.id
      arn = ou.arn
    }
  }
}
