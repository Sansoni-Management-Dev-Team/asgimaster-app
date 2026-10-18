output "security_groups" {
  description = "Map of SG key to security group attributes."
  value = {
    for key, sg in aws_security_group.this : key => {
      id   = sg.id
      arn  = sg.arn
      name = sg.name
    }
  }
}
