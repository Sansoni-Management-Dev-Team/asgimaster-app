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
  description = "Tags applied to all load balancers."
  type        = map(string)
  default     = {}
}

variable "load_balancers" {
  description = "Map of ALBs to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    internal                   = optional(bool, false)
    security_group_ids         = list(string)
    subnet_ids                 = list(string)
    enable_deletion_protection = optional(bool, false)
    tags                       = optional(map(string), {})
  }))
}
