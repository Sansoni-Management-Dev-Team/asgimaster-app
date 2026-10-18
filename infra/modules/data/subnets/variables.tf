variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "tags" {
  description = "Tag key/value pairs a subnet must have to be selected (e.g. { default = \"true\" }). All pairs must match."
  type        = map(string)
}
