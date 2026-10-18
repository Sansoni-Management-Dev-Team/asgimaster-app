variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name, used as a prefix for bucket names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. develop, staging, production)."
  type        = string
  default     = "develop"
}

variable "config_file" {
  description = "Path to the YAML configuration file defining S3 buckets."
  type        = string
}

variable "domain" {
  description = "Base domain substituted into placeholders in config_file (e.g. CORS allowed_origins). Leave unset for buckets that don't need CORS or otherwise reference."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to all buckets."
  type        = map(string)
  default     = {}
}

variable "extra_template_vars" {
  description = "Additional key/value pairs merged into every bucket policy's templatefile() render, on top of each bucket's own config.yml template_vars. Use this for values only known at the Terragrunt layer — e.g. a CloudFront distribution ARN from a dependency block — since config_file is read directly by Terraform and never sees Terragrunt's $${dependency...} interpolation."
  type        = map(string)
  default     = {}
}
