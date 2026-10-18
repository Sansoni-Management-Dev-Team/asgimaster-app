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
  description = "Tags applied to all ECS services."
  type        = map(string)
  default     = {}
}

variable "services" {
  description = "Map of ECS services to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    cluster_arn            = string
    task_definition_arn    = string
    desired_count          = optional(number, 1)
    launch_type            = optional(string, "FARGATE")
    subnet_ids             = list(string)
    security_group_ids     = list(string)
    assign_public_ip       = optional(bool, false)
    enable_execute_command = optional(bool, true)

    deployment_minimum_healthy_percent = optional(number, 100)
    deployment_maximum_percent         = optional(number, 200)
    health_check_grace_period_seconds  = optional(number, 60)

    load_balancer = optional(object({
      target_group_arn = string
      container_name   = string
      container_port   = number
    }))
  }))
}
