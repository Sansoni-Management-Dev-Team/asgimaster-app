resource "aws_internet_gateway" "this" {
  for_each = var.internet_gateways

  vpc_id = each.value.vpc_id
  tags   = each.value.tags
}
