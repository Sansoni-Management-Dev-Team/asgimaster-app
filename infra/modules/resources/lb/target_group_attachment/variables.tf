variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "target_group_attachments" {
  description = "Map of target group attachments to create. The key is used as a unique identifier."
  type = map(object({
    target_group_arn  = string
    target_id         = string
    port              = optional(number)
    availability_zone = optional(string)
  }))
}
