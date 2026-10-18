variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "identity_store_id" {
  description = "ID of the IAM Identity Center identity store."
  type        = string
}

variable "users" {
  description = "Map of users to create in IAM Identity Center. The key is used as a unique identifier."
  type = map(object({
    display_name = string
    user_name    = string
    given_name   = string
    family_name  = string
    email        = string
  }))
}
