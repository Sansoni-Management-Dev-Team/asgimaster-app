locals {
  config     = yamldecode(file(var.config_file))
  config_dir = dirname(var.config_file)
  policies   = local.config.policies
}

data "aws_caller_identity" "this" {}

resource "aws_iam_policy" "this" {
  for_each = local.policies

  name        = "${var.project}-${each.key}-${var.environment}"
  description = try(each.value.description, null)
  policy = try(
    each.value.policy_json,
    templatefile("${local.config_dir}/${each.value.policy_file}", {
      region      = var.region
      aws_account = data.aws_caller_identity.this.account_id
      project     = var.project
      environment = var.environment
    })
  )

  tags = merge(var.tags, try(each.value.tags, {}), {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
