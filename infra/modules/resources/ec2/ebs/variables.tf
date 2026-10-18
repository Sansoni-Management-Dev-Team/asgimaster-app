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

variable "volumes" {
  description = "Map of EBS volumes to create. The key is used as a unique identifier. Set instance_id and device_name together to attach the volume to an EC2 or ECS container instance; leave both unset to create a standalone volume."
  type = map(object({
    availability_zone    = string
    size                 = optional(number, 8)
    type                 = optional(string, "gp3")
    iops                 = optional(number, null)
    throughput           = optional(number, null)
    encrypted            = optional(bool, true)
    kms_key_id           = optional(string, null)
    snapshot_id          = optional(string, null)
    multi_attach_enabled = optional(bool, false)
    instance_id          = optional(string, null)
    device_name          = optional(string, null)
    tags                 = optional(map(string), {})
  }))
  default = {}

  validation {
    condition     = alltrue([for k, v in var.volumes : (v.instance_id == null) == (v.device_name == null)])
    error_message = "instance_id and device_name must be set together, or both left unset."
  }
}

variable "tags" {
  description = "Tags applied to all volumes."
  type        = map(string)
  default     = {}
}
