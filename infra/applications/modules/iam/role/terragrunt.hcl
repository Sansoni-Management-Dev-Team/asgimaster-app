terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/iam/role"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")

  tags_vars = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags      = local.tags_vars.locals[local.environment]
}

dependency "oidc" {
  config_path                             = find_in_parent_folders("modules/iam/oidc")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    oidc_providers = {
      github_actions = {
        arn = "arn:aws:oidc::abcdef"
        url = "https://github.com/your-org/your-repo"
      },
    }
  }
}

dependency "permissions" {
  config_path                             = find_in_parent_folders("modules/iam/permissions")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    policies = {
      app = {
        arn = "arn:aws:permission::abcdef"
      },
    }
  }
}


inputs = {
  config_file = "${get_terragrunt_dir()}/config/config.yml"
  managed_policy_arns = {
    app = [dependency.permissions.outputs.policies["app"].arn]
  }
  tags = local.tags
}