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

variable "config_file" {
  description = "Path to the YAML configuration file defining serverless caches."
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs where the serverless cache VPC endpoint will be deployed (all in the same VPC)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs to associate with the serverless cache VPC endpoint."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
