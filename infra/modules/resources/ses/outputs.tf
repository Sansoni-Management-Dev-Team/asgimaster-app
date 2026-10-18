output "email_identities" {
  description = "Map of email identity key to identity attributes."
  value = {
    for key, identity in aws_sesv2_email_identity.this : key => {
      arn                         = identity.arn
      email_identity              = identity.email_identity
      identity_type               = identity.identity_type
      verified_for_sending_status = identity.verified_for_sending_status
      mail_from_domain            = try(aws_sesv2_email_identity_mail_from_attributes.this[key].mail_from_domain, null)
    }
  }
}

output "dns_records" {
  description = "Map of DNS records (DKIM CNAMEs, MAIL FROM MX and SPF TXT) to publish for the identities. Shaped for the resources/route53/record module, minus zone_id."
  value       = local.dns_records
}
