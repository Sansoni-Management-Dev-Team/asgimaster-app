variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "route_tables" {
  description = "Map of route tables to create. The key is used as a unique identifier."
  type = map(object({
    vpc_id = string
    routes = optional(map(object({
      cidr_block     = string
      gateway_id     = optional(string)
      nat_gateway_id = optional(string)
    })), {})
    tags = optional(map(string), {})
  }))
}
