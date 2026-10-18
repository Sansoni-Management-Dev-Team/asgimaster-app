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
  description = "Tags applied to all listener rules."
  type        = map(string)
  default     = {}
}

variable "listener_rules" {
  description = "Map of listener rules to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    listener_arn = string
    priority     = number
    action = object({
      type             = string
      target_group_arn = optional(string)
      redirect = optional(object({
        port        = optional(string, "443")
        protocol    = optional(string, "HTTPS")
        status_code = optional(string, "HTTP_301")
        host        = optional(string, "#{host}")
        path        = optional(string, "/#{path}")
        query       = optional(string, "#{query}")
      }))
      fixed_response = optional(object({
        content_type = string
        message_body = optional(string)
        status_code  = optional(string, "200")
      }))
    })
    conditions = list(object({
      type   = string
      values = list(string)
    }))
  }))
}
