locals {
  public_associations = {
    for az, subnet in var.public_subnets : "public-${az}" => {
      network_acl_id = var.public_network_acl_id
      subnet_id      = subnet.id
    }
  }
  private_associations = {
    for az, subnet in var.private_subnets : "private-${az}" => {
      network_acl_id = var.private_network_acl_id
      subnet_id      = subnet.id
    }
  }
}

resource "aws_network_acl_association" "this" {
  for_each = merge(local.public_associations, local.private_associations)

  network_acl_id = each.value.network_acl_id
  subnet_id      = each.value.subnet_id
}
