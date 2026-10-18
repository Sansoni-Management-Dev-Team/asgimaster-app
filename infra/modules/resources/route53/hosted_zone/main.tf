resource "aws_route53_zone" "this" {
  for_each = var.hosted_zones

  name    = each.value.name
  comment = each.value.comment
  tags    = each.value.tags

  dynamic "vpc" {
    for_each = each.value.vpcs
    content {
      vpc_id     = vpc.value.vpc_id
      vpc_region = vpc.value.vpc_region
    }
  }
}
