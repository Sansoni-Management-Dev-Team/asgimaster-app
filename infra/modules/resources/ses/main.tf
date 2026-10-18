locals {
  # Domain identities get Easy DKIM; email-address identities inherit from their domain.
  is_domain = {
    for key, identity in var.email_identities : key => length(regexall("@", identity.email_identity)) == 0
  }

  mail_from_identities = {
    for key, identity in var.email_identities : key => identity
    if identity.mail_from_domain != null
  }

  dkim_records = merge([
    for key, identity in aws_sesv2_email_identity.this : {
      for idx in range(3) : "${key}-dkim-${idx}" => {
        name   = "${identity.dkim_signing_attributes[0].tokens[idx]}._domainkey.${identity.email_identity}"
        type   = "CNAME"
        values = ["${identity.dkim_signing_attributes[0].tokens[idx]}.dkim.amazonses.com"]
      }
    } if local.is_domain[key]
  ]...)

  mail_from_records = merge([
    for key, attrs in aws_sesv2_email_identity_mail_from_attributes.this : {
      "${key}-mail-from-mx" = {
        name   = attrs.mail_from_domain
        type   = "MX"
        values = ["10 feedback-smtp.${var.region}.amazonses.com"]
      }
      "${key}-mail-from-spf" = {
        name   = attrs.mail_from_domain
        type   = "TXT"
        values = ["v=spf1 include:amazonses.com ~all"]
      }
    }
  ]...)

  dns_records = merge(local.dkim_records, local.mail_from_records)
}

resource "aws_sesv2_email_identity" "this" {
  for_each = var.email_identities

  email_identity = each.value.email_identity

  dynamic "dkim_signing_attributes" {
    for_each = local.is_domain[each.key] ? [1] : []
    content {
      next_signing_key_length = each.value.dkim_signing_key_length
    }
  }

  tags = each.value.tags
}

resource "aws_sesv2_email_identity_mail_from_attributes" "this" {
  for_each = local.mail_from_identities

  email_identity         = aws_sesv2_email_identity.this[each.key].email_identity
  mail_from_domain       = each.value.mail_from_domain
  behavior_on_mx_failure = each.value.behavior_on_mx_failure
}
