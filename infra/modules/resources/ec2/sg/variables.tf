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
  description = "ID of the VPC to create security groups in."
  type        = string
}

variable "config_file" {
  description = "Path to the YAML configuration file defining security groups and their rules."
  type        = string
}

variable "source_security_groups" {
  description = "Map of logical key to SG ID for security groups defined outside this module. Keys are referenced via source_sg_key in config rules."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags applied to all security groups."
  type        = map(string)
  default     = {}
}
