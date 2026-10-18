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
  description = "Path to the YAML configuration file defining RabbitMQ brokers."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the broker(s). One subnet for SINGLE_INSTANCE; RabbitMQ CLUSTER_MULTI_AZ also takes a single subnet — Amazon MQ places the extra nodes across other AZs in the same VPC automatically."
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs to associate with the broker(s)."
  type        = list(string)
}

variable "kms_key_id" {
  description = "ARN of the KMS key used to encrypt broker storage. Typically sourced from the resources/kms module via a Terragrunt dependency block."
  type        = string
}

variable "credentials_secret_id" {
  description = "Name or ARN of the single Secrets Manager secret holding admin credentials for all brokers as flat JSON keys (e.g. MQ_USERNAME, MQ_PASSWORD). Created and populated manually, outside Terraform. Each broker in config_file selects its pair via username_key/password_key."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
