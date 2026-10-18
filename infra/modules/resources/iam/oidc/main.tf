resource "aws_iam_openid_connect_provider" "this" {
  for_each = var.oidc_providers

  url            = each.value.url
  client_id_list = each.value.client_id_list
  # With no thumbprints set, leave the list to AWS. It fills one in, and an empty list would show as a change on every plan.
  thumbprint_list = length(each.value.thumbprint_list) > 0 ? each.value.thumbprint_list : null

  tags = merge(var.tags, each.value.tags, {
    Name = each.key
  })
}
