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
  description = "Path to the YAML configuration file defining task definitions and their container definition JSON filenames."
  type        = string
}

variable "execution_role_arns" {
  description = "Map of task definition key to the IAM role ARN the ECS agent uses to pull images and publish logs to CloudWatch. Each task definition must get its own role — do not reuse the same ARN across keys."
  type        = map(string)
}

variable "task_role_arns" {
  description = "Map of task definition key to the IAM role ARN the container process uses for AWS API calls. Omit a key if that task needs no AWS permissions. Each task definition must get its own role — do not reuse the same ARN across keys."
  type        = map(string)
  default     = {}
}

variable "secret_suffix" {
  description = "Suffix appended when constructing secret identifiers for lookups inside container definition templates. Available as the secret_suffix placeholder in container_definitions templatefile()."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to all task definitions."
  type        = map(string)
  default     = {}
}
