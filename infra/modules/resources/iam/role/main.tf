locals {
  config     = yamldecode(file(var.config_file))
  config_dir = dirname(var.config_file)
  roles      = local.config.roles

  template_vars = {
    region      = var.region
    aws_account = data.aws_caller_identity.this.account_id
    project     = var.project
    environment = var.environment
  }

  inline_policies = merge([
    for role_key, role in local.roles : {
      for policy_key, policy in try(role.inline_policies, {}) :
      "${role_key}:${policy_key}" => {
        role_key   = role_key
        policy_key = policy_key
        policy     = try(policy.policy_json, templatefile("${local.config_dir}/${policy.policy_file}", local.template_vars))
      }
    }
  ]...)

  policy_attachments = merge([
    for role_key, role in local.roles : {
      for arn in distinct(concat(try(role.managed_policy_arns, []), try(var.managed_policy_arns[role_key], []))) :
      "${role_key}:${arn}" => {
        role_key   = role_key
        policy_arn = arn
      }
    }
  ]...)

  role_names = {
    for role_key, role in local.roles :
    role_key => try(role.name, "") != "" ? role.name : "${var.project}-${role_key}-${var.environment}"
  }
}

data "aws_caller_identity" "this" {}

resource "aws_iam_role" "this" {
  for_each = local.roles

  name               = local.role_names[each.key]
  assume_role_policy = templatefile("${local.config_dir}/${each.value.assume_role_policy}", local.template_vars)

  tags = merge(var.tags, try(each.value.tags, {}), {
    Name = local.role_names[each.key]
  })
}

resource "aws_iam_role_policy" "this" {
  for_each = local.inline_policies

  name   = each.value.policy_key
  role   = aws_iam_role.this[each.value.role_key].name
  policy = each.value.policy
}

resource "aws_iam_role_policy_attachment" "this" {
  for_each = local.policy_attachments

  role       = aws_iam_role.this[each.value.role_key].name
  policy_arn = each.value.policy_arn
}
