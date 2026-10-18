variable "parent_id" {
  description = "ID of the parent root or OU under which to create the organizational units."
  type        = string
}

variable "organizational_units" {
  description = "List of OU names to create under the parent."
  type        = list(string)
}

variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "tags" {
  description = "Tags to apply to each organizational unit."
  type        = map(string)
  default     = {}
}

