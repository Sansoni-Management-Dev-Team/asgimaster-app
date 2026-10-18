variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "nat_gateways" {
  description = "Map of NAT Gateways to create. The key is used as a unique identifier."
  type = map(object({
    allocation_id = string
    subnet_id     = string
    tags          = optional(map(string), {})
  }))
}
