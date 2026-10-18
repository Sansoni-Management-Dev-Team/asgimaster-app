resource "aws_nat_gateway" "this" {
  for_each = var.nat_gateways

  allocation_id = each.value.allocation_id
  subnet_id     = each.value.subnet_id
  tags          = each.value.tags
}
