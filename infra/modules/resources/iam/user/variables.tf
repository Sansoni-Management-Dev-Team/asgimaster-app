variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "users" {
  description = "Map of IAM users to create. The key is used as the IAM user name and as a unique identifier."
  type = map(object({
    path                  = optional(string, "/")
    permissions_boundary  = optional(string, null)
    groups                = optional(list(string), [])
    managed_policy_arns   = optional(list(string), [])
    tags                  = optional(map(string), {})
  }))
}
