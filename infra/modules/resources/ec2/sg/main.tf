locals {
  config          = yamldecode(file(var.config_file))
  security_groups = local.config.security_groups

  ingress_rules = merge([
    for sg_key, sg in local.security_groups : {
      for rule_key, rule in try(sg.ingress, {}) :
      "${sg_key}:${rule_key}" => merge(rule, { sg_key = sg_key })
    }
  ]...)

  egress_rules = merge([
    for sg_key, sg in local.security_groups : {
      for rule_key, rule in try(sg.egress, {}) :
      "${sg_key}:${rule_key}" => merge(rule, { sg_key = sg_key })
    }
  ]...)
}

resource "aws_security_group" "this" {
  for_each = local.security_groups

  name        = "${var.project}-${each.key}-${var.environment}"
  description = try(each.value.description, "${var.project}-${each.key}-${var.environment}")
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_vpc_security_group_ingress_rule" "this" {
  for_each = local.ingress_rules

  security_group_id = aws_security_group.this[each.value.sg_key].id
  description       = try(each.value.description, null)
  ip_protocol       = tostring(each.value.protocol)
  from_port         = tostring(each.value.protocol) == "-1" ? null : each.value.from_port
  to_port           = tostring(each.value.protocol) == "-1" ? null : each.value.to_port

  cidr_ipv4 = try(each.value.cidr_ipv4, null)

  # Resolves intra-module SG references first, then falls back to externally supplied IDs.
  referenced_security_group_id = (
    try(each.value.source_sg_key, null) != null
    ? try(
        aws_security_group.this[each.value.source_sg_key].id,
        var.source_security_groups[each.value.source_sg_key]
      )
    : null
  )
}

resource "aws_vpc_security_group_egress_rule" "this" {
  for_each = local.egress_rules

  security_group_id = aws_security_group.this[each.value.sg_key].id
  description       = try(each.value.description, null)
  ip_protocol       = tostring(each.value.protocol)
  from_port         = tostring(each.value.protocol) == "-1" ? null : each.value.from_port
  to_port           = tostring(each.value.protocol) == "-1" ? null : each.value.to_port

  cidr_ipv4 = try(each.value.cidr_ipv4, null)

  referenced_security_group_id = (
    try(each.value.source_sg_key, null) != null
    ? try(
        aws_security_group.this[each.value.source_sg_key].id,
        var.source_security_groups[each.value.source_sg_key]
      )
    : null
  )
}
