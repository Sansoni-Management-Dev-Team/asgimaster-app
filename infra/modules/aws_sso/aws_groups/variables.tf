variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "identity_store_id" {
  description = "ID of the IAM Identity Center identity store."
  type        = string
}

variable "groups" {
  description = "Map of groups to create in IAM Identity Center. The key is used as a unique identifier."
  type = map(object({
    display_name = string
    description  = optional(string, null)
  }))
}
