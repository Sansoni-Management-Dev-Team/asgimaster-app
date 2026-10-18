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

variable "vpc_id" {
  description = "ID of the VPC to associate target groups with."
  type        = string
}

variable "config_file" {
  description = "Path to the YAML configuration file defining target groups and their health check settings."
  type        = string
}

variable "tags" {
  description = "Tags applied to all target groups."
  type        = map(string)
  default     = {}
}
