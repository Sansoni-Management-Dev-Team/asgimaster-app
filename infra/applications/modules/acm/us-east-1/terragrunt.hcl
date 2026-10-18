terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/acm?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
  domain      = read_terragrunt_config(find_in_parent_folders("domain.hcl")).locals[local.environment]
  region      = "us-east-1"
}

inputs = {
  region = local.region
  certificates = {
    scaling = {
      domain_name               = local.domain.app_host
      subject_alternative_names = ["*.${local.domain.zone_name}"]
      validation_method         = "DNS"
      tags                      = local.tags
    }
  }
}