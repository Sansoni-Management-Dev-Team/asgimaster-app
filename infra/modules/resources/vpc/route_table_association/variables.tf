variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "public_subnets" {
  description = "Map of AZ name to public subnet attributes. Pass the public_subnets output from the subnet module directly."
  type = map(object({
    id                = string
    cidr_block        = string
    availability_zone = string
    vpc_id            = string
  }))
}

variable "private_subnets" {
  description = "Map of AZ name to private subnet attributes. Pass the private_subnets output from the subnet module directly."
  type = map(object({
    id                = string
    cidr_block        = string
    availability_zone = string
    vpc_id            = string
  }))
}

variable "public_route_table_id" {
  description = "ID of the public route table."
  type        = string
}

variable "private_route_table_id" {
  description = "ID of the private route table. For non-live, one shared table. For live, pass the AZ-local table."
  type        = string
}
