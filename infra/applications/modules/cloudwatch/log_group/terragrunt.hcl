terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/cloudwatch/log_group?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
}

inputs = {
  log_groups = {
    app = {
      name              = "app"
      retention_in_days = 14
      prefix            = "/ecs/"
    }
  }

  tags = local.tags
}