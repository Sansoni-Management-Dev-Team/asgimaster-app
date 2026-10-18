# resources/route53/record

Creates one or more Route53 DNS records. Commonly used in conjunction with the `resources/acm` module to create the CNAME records required for ACM DNS validation.

## Sample Terragrunt Usage

### ACM DNS Validation Records

Wire the ACM `domain_validation_options` output directly into this module's `records` input.

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/route53/record?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "hosted_zone" {
  config_path = "../hosted_zone"
}

dependency "acm" {
  config_path = "../../acm"
}

locals {
  validation_records = merge([
    for cert_key, cert in dependency.acm.outputs.certificates : {
      for dvo in cert.domain_validation_options : dvo.domain_name => {
        zone_id = dependency.hosted_zone.outputs.hosted_zones["prod"].id
        name    = dvo.resource_record_name
        type    = dvo.resource_record_type
        ttl     = 60
        values  = [dvo.resource_record_value]
      }
    }
  ]...)
}

inputs = {
  records = local.validation_records
}
```

### A Record Alias to an ALB

For alias records (ALB, NLB, CloudFront, etc.), set `alias` instead of `ttl`/`values`. The alias `zone_id` is the target's own hosted zone ID (e.g. the ALB's `zone_id`, not your Route53 hosted zone).

```hcl
dependency "alb" {
  config_path = "../../alb"
}

inputs = {
  records = {
    app-alias = {
      zone_id = dependency.hosted_zone.outputs.hosted_zones["prod"].id
      name    = "app.yourdomain.com"
      type    = "A"
      alias = {
        name                   = dependency.alb.outputs.dns_name
        zone_id                = dependency.alb.outputs.zone_id
        evaluate_target_health = true
      }
    }
  }
}
```

### General DNS Records

```hcl
inputs = {
  records = {
    api-cname = {
      zone_id = dependency.hosted_zone.outputs.hosted_zones["prod"].id
      name    = "api.yourdomain.com"
      type    = "CNAME"
      ttl     = 300
      values  = ["lb-123456.ap-southeast-1.elb.amazonaws.com"]
    }
    root-a = {
      zone_id = dependency.hosted_zone.outputs.hosted_zones["prod"].id
      name    = "yourdomain.com"
      type    = "A"
      ttl     = 300
      values  = ["1.2.3.4"]
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `records` | Map of Route53 records to create | `map(object)` | — | yes |
| `records[*].zone_id` | ID of the hosted zone to create the record in | `string` | — | yes |
| `records[*].name` | DNS name of the record | `string` | — | yes |
| `records[*].type` | Record type (`A`, `CNAME`, `TXT`, `MX`, etc.) | `string` | — | yes |
| `records[*].ttl` | Time-to-live in seconds (ignored if `alias` is set) | `number` | `300` | no |
| `records[*].values` | List of record values (ignored if `alias` is set) | `list(string)` | — | no* |
| `records[*].alias` | Alias target block; set instead of `ttl`/`values` | `object` | `null` | no* |
| `records[*].alias.name` | DNS name of the alias target (e.g. ALB `dns_name`) | `string` | — | yes, if `alias` set |
| `records[*].alias.zone_id` | Hosted zone ID of the alias target (e.g. ALB `zone_id`) | `string` | — | yes, if `alias` set |
| `records[*].alias.evaluate_target_health` | Whether Route53 should evaluate the target's health | `bool` | `false` | no |

\* Either `values` or `alias` must be set.

## Outputs

| Name | Description |
|------|-------------|
| `records` | Map of record key to `{ fqdn, name, type }` |
