terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/acm"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")

  tags_vars = read_terragrunt_config(find_in_parent_folders("tags.hcl"))

  tags   = local.tags_vars.locals[local.environment]
  domain = read_terragrunt_config(find_in_parent_folders("domain.hcl")).locals[local.environment]
}

inputs = {
  certificates = {
    scaling = {
      domain_name               = local.domain.app_host
      subject_alternative_names = ["*.${local.domain.zone_name}"]
      validation_method         = "DNS"
      tags                      = local.tags
    }
  }
}