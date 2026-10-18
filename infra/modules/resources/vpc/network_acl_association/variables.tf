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

variable "public_network_acl_id" {
  description = "ID of the Network ACL to associate with public subnets."
  type        = string
}

variable "private_network_acl_id" {
  description = "ID of the Network ACL to associate with private subnets."
  type        = string
}
