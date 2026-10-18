terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/ses?ref=0.0.24"
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
  email_identities = {
    main = {
      email_identity   = local.domain.zone_name
      mail_from_domain = "bounce.${local.domain.zone_name}"
      tags             = local.tags
    }
  }
}