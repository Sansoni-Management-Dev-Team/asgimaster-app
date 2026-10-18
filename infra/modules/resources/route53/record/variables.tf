variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "records" {
  description = "Map of Route53 records to create. The key is used as a unique identifier. Set `alias` for an alias record (e.g. to an ALB/NLB/CloudFront); otherwise `ttl`/`values` create a standard record."
  type = map(object({
    zone_id = string
    name    = string
    type    = string
    ttl     = optional(number, 300)
    values  = optional(list(string))
    alias = optional(object({
      name                   = string
      zone_id                = string
      evaluate_target_health = optional(bool, false)
    }))
  }))
}
