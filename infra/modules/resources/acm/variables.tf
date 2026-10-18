variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "certificates" {
  description = "Map of ACM certificates to create. The key is used as a unique identifier."
  type = map(object({
    domain_name               = string
    subject_alternative_names = optional(list(string), [])
    validation_method         = optional(string, "DNS")
    key_algorithm             = optional(string, null)
    tags                      = optional(map(string), {})
  }))
}
