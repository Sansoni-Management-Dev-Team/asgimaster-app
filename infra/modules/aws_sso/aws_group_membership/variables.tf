variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "identity_store_id" {
  description = "ID of the IAM Identity Center identity store."
  type        = string
}

variable "memberships" {
  description = "Map of group memberships to create. Each entry specifies a group and a list of user IDs to add. The key is used as a unique identifier."
  type = map(object({
    group_id = string
    users    = list(string)
  }))
}
