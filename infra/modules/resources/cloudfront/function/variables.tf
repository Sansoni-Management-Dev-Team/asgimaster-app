variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "functions" {
  description = "Map of CloudFront Functions to create. The key is used as a unique identifier."
  type = map(object({
    name                         = string
    file_path                    = string
    runtime                      = optional(string, "cloudfront-js-2.0")
    comment                      = optional(string, null)
    publish                      = optional(bool, true)
    key_value_store_associations = optional(list(string), [])
    tags                         = optional(map(string), {})
  }))

  validation {
    condition     = alltrue([for k, v in var.functions : endswith(v.file_path, ".js")])
    error_message = "file_path must point to a .js file."
  }
}
