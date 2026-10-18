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
  description = "Path to the YAML configuration file defining Aurora Serverless v2 clusters."
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the DB subnet group (minimum 2, across AZs)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs to associate with the cluster."
  type        = list(string)
}

variable "kms_key_id" {
  description = "ARN of the KMS key used to encrypt cluster storage. Typically sourced from the resources/kms module via a Terragrunt dependency block."
  type        = string
}

variable "credentials_secret_id" {
  description = "Name or ARN of the single Secrets Manager secret holding master credentials for all clusters as flat JSON keys (e.g. DB_USERNAME, DB_PASSWORD). Created and populated manually, outside Terraform. Each cluster in config_file selects its pair via username_key/password_key."
  type        = string
}

variable "publicly_accessible" {
  description = "Whether cluster instances get a public IP. Only reachable if subnet_ids are public subnets (route to an Internet Gateway) and security_group_ids allow inbound on the DB port."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
