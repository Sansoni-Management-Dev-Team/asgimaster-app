resource "aws_network_acl" "this" {
  for_each = var.network_acls

  vpc_id = each.value.vpc_id
  tags   = each.value.tags
}
