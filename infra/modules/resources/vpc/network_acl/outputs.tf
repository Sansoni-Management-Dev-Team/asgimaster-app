output "network_acls" {
  description = "Map of Network ACL key to attributes."
  value = {
    for key, nacl in aws_network_acl.this : key => {
      id     = nacl.id
      vpc_id = nacl.vpc_id
    }
  }
}
