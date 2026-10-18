resource "aws_route_table" "this" {
  for_each = var.route_tables

  vpc_id = each.value.vpc_id

  dynamic "route" {
    for_each = each.value.routes
    content {
      cidr_block     = route.value.cidr_block
      gateway_id     = route.value.gateway_id
      nat_gateway_id = route.value.nat_gateway_id
    }
  }

  tags = each.value.tags
}
