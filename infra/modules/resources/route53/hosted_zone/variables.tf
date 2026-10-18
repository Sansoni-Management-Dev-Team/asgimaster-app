variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "hosted_zones" {
  description = "Map of Route53 hosted zones to create. The key is used as a unique identifier."
  type = map(object({
    name    = string
    comment = optional(string, null)
    tags    = optional(map(string), {})
    vpcs = optional(list(object({
      vpc_id     = string
      vpc_region = optional(string, null)
    })), [])
  }))
}
