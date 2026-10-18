variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "tags" {
  description = "Tag key/value pairs identifying the VPC (e.g. { default = \"true\" }). All pairs must match, and exactly one VPC must match."
  type        = map(string)
}
