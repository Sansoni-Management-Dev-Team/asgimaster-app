terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/iam/oidc"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")

  tags_vars = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags      = local.tags_vars.locals[local.environment]
}

inputs = {
  oidc_providers = {
    github_actions = {
      url            = "https://token.actions.githubusercontent.com"
      client_id_list = ["sts.amazonaws.com"]
    }
  }

  tags = local.tags
}