variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name, used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. develop, staging, production)."
  type        = string
  default     = "develop"
}

variable "tags" {
  description = "Tags applied to all bastion instances."
  type        = map(string)
  default     = {}
}

variable "instances" {
  description = "Map of bastion EC2 instances to create. The key is used as the name suffix and resource identifier."
  type = map(object({
    subnet_id              = string
    vpc_security_group_ids = list(string)
    ami                    = optional(string, null)
    instance_type          = optional(string, "t3.micro")
    associate_public_ip    = optional(bool, true)
    root_volume_size       = optional(number, 8)
    root_volume_kms_key_id = optional(string, null)
    tags                   = optional(map(string), {})
  }))
}
