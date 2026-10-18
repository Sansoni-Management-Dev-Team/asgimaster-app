terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/route53/hosted_zone?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
  domain      = read_terragrunt_config(find_in_parent_folders("domain.hcl")).locals[local.environment]
}

inputs = {
  hosted_zones = {
    default = {
      name    = local.domain.zone_name
      comment = "default hosted zone"
      tags    = local.tags
    }
  }
}