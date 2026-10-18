# resources/vpc/network_acl_rule

Creates Network ACL rules for one or more Network ACLs. Rules live in a YAML config file, grouped by Network ACL key and then by `ingress`/`egress`. NACLs are stateless, so both directions must be explicitly defined. Use `protocol = "-1"` for all traffic; omit `from_port` and `to_port` when doing so.

The `network_acls` keys in `config_file` must match the keys of the `network_acl_ids` input, which maps each key to the real Network ACL ID (typically supplied via a Terragrunt `dependency` block on `resources/vpc/network_acl`).

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl_rule?ref=v0.0.x"
}

dependency "network_acl" {
  config_path = "../network_acl"
}

inputs = {
  network_acl_ids = {
    public  = dependency.network_acl.outputs.network_acls["public"].id
    private = dependency.network_acl.outputs.network_acls["private"].id
  }

  config_file = "${get_terragrunt_dir()}/config/config.yml"
}
```

### config/config.yml

Rules are **maps** (not lists) so that adding or removing a rule never affects the state of other rules.

```yaml
network_acls:
  public:
    ingress:
      allow_all:
        rule_number: 100
        protocol: "-1"
        rule_action: allow
        cidr_block: "0.0.0.0/0"
    egress:
      allow_all:
        rule_number: 100
        protocol: "-1"
        rule_action: allow
        cidr_block: "0.0.0.0/0"

  private:
    ingress:
      allow_http_from_vpc:
        rule_number: 100
        protocol: "6"
        rule_action: allow
        cidr_block: "10.0.0.0/16"
        from_port: 80
        to_port: 80
    egress:
      allow_all:
        rule_number: 100
        protocol: "-1"
        rule_action: allow
        cidr_block: "0.0.0.0/0"
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider. | `string` | `"ap-southeast-1"` | no |
| `network_acl_ids` | Map of Network ACL key to Network ACL ID. Keys must match the `network_acls` keys in `config_file`. | `map(string)` | n/a | yes |
| `config_file` | Absolute path to the YAML config file. | `string` | n/a | yes |

### config.yml network_acls fields

| Field | Description |
|-------|-------------|
| `ingress` | Map of ingress rules (key = stable rule name) |
| `egress` | Map of egress rules (key = stable rule name) |

### Rule fields

| Field | Description |
|-------|-------------|
| `rule_number` | Rule evaluation order. Lower numbers are evaluated first. |
| `protocol` | Protocol. Use `"-1"` for all traffic, `"6"` for TCP, `"17"` for UDP. |
| `rule_action` | `"allow"` or `"deny"`. |
| `cidr_block` | CIDR block to match. |
| `from_port` | Start of port range. Required for TCP/UDP. |
| `to_port` | End of port range. Required for TCP/UDP. |
| `icmp_type` | ICMP type. Required when protocol is ICMP. |
| `icmp_code` | ICMP code. Required when protocol is ICMP. |

## Outputs

| Name | Description |
|------|-------------|
| `network_acl_rules` | Map of rule key (`"<network_acl_key>:ingress\|egress:<rule_key>"`) to attributes (id, network_acl_id, rule_number, egress). |
