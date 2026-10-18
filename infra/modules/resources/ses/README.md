# resources/ses

Creates one or more Amazon SES (v2) email identities for sending email. Domain identities are verified with Easy DKIM (three CNAME records), and can optionally use a custom MAIL FROM subdomain so SPF aligns for DMARC. The module does not write DNS — the `dns_records` output is shaped for the `resources/route53/record` module (add `zone_id`), or can be copied into an external DNS provider.

Designed to coexist with Microsoft 365 on the same domain: SES only adds `_domainkey` CNAMEs and records on a dedicated MAIL FROM subdomain (e.g. `mail.yourdomain.com`), so the root domain's M365 MX, SPF, and `selector1/selector2` DKIM records are left untouched.

## Prerequisites outside Terraform

- **Production access** — new accounts are in the SES sandbox (can only send to verified addresses, 200/day). Request production access per region: `aws sesv2 put-account-details --production-access-enabled --mail-type TRANSACTIONAL --website-url https://yourdomain.com --contact-language EN --region ap-southeast-1`.
- **DMARC** — the root domain's `_dmarc` TXT record is shared with Microsoft 365, so manage it with the rest of the domain's mail DNS. Do not use strict SPF alignment (`aspf=s`), since the MAIL FROM is a subdomain.
- **Sending credentials** — applications on AWS (ECS, EC2, Lambda) should use an IAM role with `ses:SendEmail` / `ses:SendRawEmail` on the identity ARN. If an app needs SMTP, create the IAM user's SMTP credentials manually and store them in Secrets Manager; this module never creates them.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ses?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  email_identities = {
    main = {
      email_identity   = "yourdomain.com"
      mail_from_domain = "mail.yourdomain.com"
      tags             = { Environment = "prod" }
    }
  }
}
```

### Publishing the DNS records with `resources/route53/record`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/route53/record?ref=v1.0.0"
}

dependency "hosted_zone" {
  config_path = "../hosted_zone"
}

dependency "ses" {
  config_path = "../../ses"
}

inputs = {
  records = {
    for key, record in dependency.ses.outputs.dns_records : key => merge(record, {
      zone_id = dependency.hosted_zone.outputs.hosted_zones["prod"].id
    })
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider; SES identities are regional | `string` | `"ap-southeast-1"` | no |
| `email_identities` | Map of SES email identities to create | `map(object)` | — | yes |
| `email_identities[*].email_identity` | Domain (e.g. `yourdomain.com`) or email address to verify | `string` | — | yes |
| `email_identities[*].dkim_signing_key_length` | Easy DKIM key length (`RSA_1024_BIT` or `RSA_2048_BIT`); domains only | `string` | `"RSA_2048_BIT"` | no |
| `email_identities[*].mail_from_domain` | Custom MAIL FROM subdomain (e.g. `mail.yourdomain.com`); must not be used to receive email | `string` | `null` | no |
| `email_identities[*].behavior_on_mx_failure` | What to do if the MAIL FROM MX record is missing (`USE_DEFAULT_VALUE` or `REJECT_MESSAGE`) | `string` | `"USE_DEFAULT_VALUE"` | no |
| `email_identities[*].tags` | Tags to apply to the identity | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `email_identities` | Map of identity key to `{ arn, email_identity, identity_type, verified_for_sending_status, mail_from_domain }` |
| `dns_records` | Map of record key (`<key>-dkim-<n>`, `<key>-mail-from-mx`, `<key>-mail-from-spf`) to `{ name, type, values }` |
