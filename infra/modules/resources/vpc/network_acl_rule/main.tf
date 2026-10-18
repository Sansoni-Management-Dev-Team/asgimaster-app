locals {
  config       = yamldecode(file(var.config_file))
  network_acls = local.config.network_acls

  rules = merge([
    for acl_key, acl in local.network_acls : merge(
      {
        for rule_key, rule in try(acl.ingress, {}) :
        "${acl_key}:ingress:${rule_key}" => merge(rule, { acl_key = acl_key, egress = false })
      },
      {
        for rule_key, rule in try(acl.egress, {}) :
        "${acl_key}:egress:${rule_key}" => merge(rule, { acl_key = acl_key, egress = true })
      }
    )
  ]...)
}

resource "aws_network_acl_rule" "this" {
  for_each = local.rules

  network_acl_id = var.network_acl_ids[each.value.acl_key]
  rule_number    = each.value.rule_number
  egress         = each.value.egress
  protocol       = each.value.protocol
  rule_action    = each.value.rule_action
  cidr_block     = try(each.value.cidr_block, null)
  from_port      = try(each.value.from_port, null)
  to_port        = try(each.value.to_port, null)
  icmp_type      = try(each.value.icmp_type, null)
  icmp_code      = try(each.value.icmp_code, null)
}
