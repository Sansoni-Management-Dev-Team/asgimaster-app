resource "aws_cloudfront_function" "this" {
  for_each = var.functions

  name                         = each.value.name
  runtime                      = each.value.runtime
  comment                      = each.value.comment
  publish                      = each.value.publish
  code                         = file(each.value.file_path)
  key_value_store_associations = each.value.key_value_store_associations
  tags                         = each.value.tags
}
