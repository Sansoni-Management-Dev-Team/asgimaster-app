variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name, used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. develop, staging, production)."
  type        = string
  default     = "develop"
}

variable "keys" {
  description = "Map of KMS keys to create. The key is used as a unique identifier and forms the alias name."
  type = map(object({
    description             = string
    deletion_window_in_days = optional(number, 30)
    enable_key_rotation     = optional(bool, true)
    policy                  = optional(string, null)
    tags                    = optional(map(string), {})
  }))
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
