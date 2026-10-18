variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "accounts" {
  description = "Map of accounts to create. The key is used as a unique identifier."
  type = map(object({
    name      = string
    email     = string
    parent_id = optional(string, null)
    role_name = optional(string, "OrganizationAccountAccessRole")
    tags      = optional(map(string), {})
  }))
}

