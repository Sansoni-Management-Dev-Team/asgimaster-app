variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name, used as a prefix for role names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. develop, staging, production)."
  type        = string
  default     = "develop"
}

variable "config_file" {
  description = "Path to the YAML configuration file defining IAM roles."
  type        = string
}

variable "tags" {
  description = "Tags applied to all IAM roles."
  type        = map(string)
  default     = {}
}

variable "managed_policy_arns" {
  description = "Map of role key to a list of additional managed policy ARNs to attach, for ARNs sourced from a separate Terragrunt dependency (e.g. resources/iam/permissions outputs) that the static config_file can't reference directly. Merged with each role's config.yml managed_policy_arns list."
  type        = map(list(string))
  default     = {}
}
