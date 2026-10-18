variable "region" {
  description = "AWS region to use for the provider. CloudFront and its ACM certificate must be managed from us-east-1; an origin bucket in another region is looked up via its own bucket_region in config.yml, not this variable."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used as a prefix for distribution and OAC names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. develop, staging, production)."
  type        = string
  default     = "develop"
}

variable "config_file" {
  description = "Path to the YAML configuration file defining CloudFront distributions and their S3 origins."
  type        = string
}

variable "tags" {
  description = "Tags applied to all distributions."
  type        = map(string)
  default     = {}
}

variable "acm_certificate_arn_overrides" {
  description = "Map of distribution_key to an ACM certificate ARN that overrides the distribution's config.yml acm_certificate_arn. Use this to pass the ARN from a resources/acm dependency block, since config_file is read directly by Terraform and never sees Terragrunt's $${dependency...} interpolation."
  type        = map(string)
  default     = {}
}

variable "function_arn_overrides" {
  description = "Map of \"<distribution_key>:<cache_behavior_key>:<event_type>\" to a CloudFront Function ARN that overrides the matching config.yml function_associations entry's function_arn. cache_behavior_key is \"default\" for default_cache_behavior, or the key from ordered_cache_behaviors. Use this to pass the ARN from a resources/cloudfront/function dependency block, since config_file is read directly by Terraform and never sees Terragrunt's $${dependency...} interpolation."
  type        = map(string)
  default     = {}
}
