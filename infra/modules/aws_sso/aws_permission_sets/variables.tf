variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "instance_arn" {
  description = "ARN of the IAM Identity Center instance."
  type        = string
}

variable "tags" {
  description = "Tags to apply to all permission sets."
  type        = map(string)
  default     = {}
}

variable "permission_sets" {
  description = "Map of permission sets to create. Each entry attaches one or more AWS managed policies. The key is used as a unique identifier."
  type = map(object({
    name             = string
    description      = optional(string, null)
    session_duration = optional(string, "PT1H")
    managed_policies = list(string)
  }))
}
