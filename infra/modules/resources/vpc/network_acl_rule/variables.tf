variable "region" {
  description = "AWS region to use for the provider."
  type        = string
  default     = "ap-southeast-1"
}

variable "network_acl_ids" {
  description = "Map of Network ACL key to Network ACL ID. Keys must match the network_acls keys in config_file."
  type        = map(string)
}

variable "config_file" {
  description = "Path to the YAML configuration file defining Network ACLs and their ingress/egress rules."
  type        = string
}
