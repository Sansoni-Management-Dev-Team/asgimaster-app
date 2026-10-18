variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "config_file" {
  description = "Path to the YAML configuration file defining ECR repositories and their lifecycle policy JSON filenames."
  type        = string
}

variable "tags" {
  description = "Tags to apply to all ECR repositories."
  type        = map(string)
  default     = {}
}


variable "project" {
  description = "AWS region to use for the provider."
  type        = string
}

variable "environment" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "develop"
}