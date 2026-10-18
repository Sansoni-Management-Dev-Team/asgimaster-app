variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "network_acls" {
  description = "Map of Network ACLs to create. The key is used as a unique identifier."
  type = map(object({
    vpc_id = string
    tags   = optional(map(string), {})
  }))
}
