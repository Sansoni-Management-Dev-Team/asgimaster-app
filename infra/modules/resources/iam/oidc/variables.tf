variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "oidc_providers" {
  description = "Map of IAM OIDC identity providers to create. The key is used as a unique identifier."
  type = map(object({
    url             = string
    client_id_list  = optional(list(string), ["sts.amazonaws.com"])
    thumbprint_list = optional(list(string), [])
    tags            = optional(map(string), {})
  }))
}

variable "tags" {
  description = "Tags applied to all OIDC providers."
  type        = map(string)
  default     = {}
}
