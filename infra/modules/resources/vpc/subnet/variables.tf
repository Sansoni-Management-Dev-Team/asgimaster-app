variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "AWS region to use for the provider."
  type        = string
}

variable "environment" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "develop"
}

variable "vpc_id" {
  description = "ID of the VPC to create subnets in."
  type        = string
}

variable "public_cidrs" {
  description = "List of CIDR blocks for public subnets. One subnet is created per entry, assigned to AZs in order. Minimum 2."
  type        = list(string)

  validation {
    condition     = length(var.public_cidrs) >= 2
    error_message = "At least 2 public CIDR blocks are required for a multi-AZ setup."
  }
}

variable "private_cidrs" {
  description = "List of CIDR blocks for private subnets. One subnet is created per entry, assigned to AZs in order. Minimum 2."
  type        = list(string)

  validation {
    condition     = length(var.private_cidrs) >= 2
    error_message = "At least 2 private CIDR blocks are required for a multi-AZ setup."
  }
}

variable "database_cidrs" {
  description = "List of CIDR blocks for database subnets. One subnet is created per entry, assigned to AZs in order. Minimum 2."
  type        = list(string)

  validation {
    condition     = length(var.database_cidrs) >= 2
    error_message = "At least 2 database CIDR blocks are required for a multi-AZ setup."
  }
}

variable "tags" {
  description = "Tags to apply to all subnets."
  type        = map(string)
  default     = {}
}
