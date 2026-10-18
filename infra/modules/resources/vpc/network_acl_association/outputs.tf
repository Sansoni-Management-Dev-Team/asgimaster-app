output "network_acl_associations" {
  description = "Map of Network ACL association key to attributes."
  value = {
    for key, assoc in aws_network_acl_association.this : key => {
      id             = assoc.id
      network_acl_id = assoc.network_acl_id
      subnet_id      = assoc.subnet_id
    }
  }
}
