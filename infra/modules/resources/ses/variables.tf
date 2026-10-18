variable "region" {
  description = "AWS region to use for the provider. SES identities are regional — send from the same region."
  type        = string
  default     = "ap-southeast-1"
}

variable "email_identities" {
  description = "Map of SES email identities (domains or email addresses) to create. The key is used as a unique identifier."
  type = map(object({
    email_identity          = string
    dkim_signing_key_length = optional(string, "RSA_2048_BIT")
    mail_from_domain        = optional(string, null)
    behavior_on_mx_failure  = optional(string, "USE_DEFAULT_VALUE")
    tags                    = optional(map(string), {})
  }))
}
