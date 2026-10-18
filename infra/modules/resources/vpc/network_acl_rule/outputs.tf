output "network_acl_rules" {
  description = "Map of Network ACL rule key to attributes."
  value = {
    for key, rule in aws_network_acl_rule.this : key => {
      id             = rule.id
      network_acl_id = rule.network_acl_id
      rule_number    = rule.rule_number
      egress         = rule.egress
    }
    # key format: "<network_acl_key>:ingress|egress:<rule_key>"
  }
}
