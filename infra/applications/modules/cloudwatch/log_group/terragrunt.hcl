terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/cloudwatch/log_group"
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