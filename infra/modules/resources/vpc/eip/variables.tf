variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "eips" {
  description = "Map of Elastic IPs to create. The key is used as a unique identifier."
  type = map(object({
    tags = optional(map(string), {})
  }))
}
