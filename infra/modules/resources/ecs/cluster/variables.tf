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
  description = "Tags applied to all clusters."
  type        = map(string)
  default     = {}
}

variable "clusters" {
  description = "Map of ECS clusters to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    container_insights = optional(string, "disabled")
    tags               = optional(map(string), {})
  }))
}
