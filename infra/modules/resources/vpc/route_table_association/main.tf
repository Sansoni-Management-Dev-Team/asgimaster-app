locals {
  public_associations = {
    for az, subnet in var.public_subnets : "public-${az}" => {
      subnet_id      = subnet.id
      route_table_id = var.public_route_table_id
    }
  }
  private_associations = {
    for az, subnet in var.private_subnets : "private-${az}" => {
      subnet_id      = subnet.id
      route_table_id = var.private_route_table_id
    }
  }
}

resource "aws_route_table_association" "this" {
  for_each = merge(local.public_associations, local.private_associations)

  subnet_id      = each.value.subnet_id
  route_table_id = each.value.route_table_id
}
