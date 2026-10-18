variable "region" {
  description = "AWS region to use for the provider. CloudFront and its ACM certificate must be managed from us-east-1; an S3 origin bucket's aws_s3_bucket_policy is applied in its own bucket_region from config.yml, not this variable, if different."
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
  description = "Path to the YAML configuration file defining CloudFront distributions and their origins."
  type        = string
}

variable "tags" {
  description = "Tags applied to all distributions."
  type        = map(string)
  default     = {}
}

variable "origin_domain_name_overrides" {
  description = "Map of \"<distribution_key>:<origin_key>\" to a domain name that overrides any origin's resolved domain name — an s3-type origin's config.yml domain_name (or its bucket's regional domain name from s3_bucket_overrides), or an alb/custom-type origin's config.yml domain_name. Use this for values only known at the Terragrunt layer — e.g. an ALB's dns_name from a dependency block, or an API Gateway invoke domain. Since config_file is read directly by Terraform, it never sees Terragrunt's $${dependency...} interpolation."
  type        = map(string)
  default     = {}
}

variable "s3_bucket_overrides" {
  description = "Map of \"<distribution_key>:<origin_key>\" to the origin's S3 bucket id, arn, and bucket_regional_domain_name, for every s3-type origin (unless that origin sets its own domain_name). This module no longer looks buckets up by name via a data source — wire it from a resources/s3 dependency block's `buckets` output (e.g. `dependency.s3.outputs.buckets[\"static-assets\"]`), so Terragrunt's dependency graph is what guarantees the bucket exists before this module applies, not an assumption baked into this module."
  type = map(object({
    id                          = string
    arn                         = string
    bucket_regional_domain_name = string
  }))
  default = {}
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
