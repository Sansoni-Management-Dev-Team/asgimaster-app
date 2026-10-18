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

variable "tags" {
  description = "Tags applied to all CloudWatch log groups."
  type        = map(string)
  default     = {}
}

variable "log_groups" {
  description = "Map of CloudWatch log groups to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    name              = string
    prefix            = optional(string, "")
    retention_in_days = optional(number, 30)
    kms_key_id        = optional(string)
    tags              = optional(map(string), {})
  }))
}
