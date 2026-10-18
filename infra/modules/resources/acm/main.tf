resource "aws_acm_certificate" "this" {
  for_each = var.certificates

  domain_name               = each.value.domain_name
  subject_alternative_names = each.value.subject_alternative_names
  validation_method         = each.value.validation_method
  key_algorithm             = each.value.key_algorithm
  tags                      = each.value.tags

  lifecycle {
    create_before_destroy = true
  }
}
