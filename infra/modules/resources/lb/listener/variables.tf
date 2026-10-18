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
  description = "Tags applied to all listeners."
  type        = map(string)
  default     = {}
}

variable "listeners" {
  description = "Map of listeners to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    load_balancer_arn = string
    port              = number
    protocol          = string
    certificate_arn   = optional(string)
    ssl_policy        = optional(string, "ELBSecurityPolicy-TLS13-1-2-2021-06")
    default_action = object({
      type             = string
      target_group_arn = optional(string)
      redirect = optional(object({
        port        = optional(string, "443")
        protocol    = optional(string, "HTTPS")
        status_code = optional(string, "HTTP_301")
      }))
      fixed_response = optional(object({
        content_type = string
        message_body = optional(string)
        status_code  = optional(string, "200")
      }))
    })
  }))
}
