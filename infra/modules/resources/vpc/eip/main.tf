resource "aws_eip" "this" {
  for_each = var.eips

  domain = "vpc"
  tags   = each.value.tags
}
