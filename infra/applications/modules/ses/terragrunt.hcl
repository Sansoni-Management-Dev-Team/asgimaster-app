terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/ses"
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