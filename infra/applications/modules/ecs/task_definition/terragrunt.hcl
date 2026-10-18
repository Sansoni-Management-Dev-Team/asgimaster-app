terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/ecs/task_definition?ref=0.0.8"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]

  # on first provision, turn this to false
  # once provisioned, turn this to true
  exclude = {
    develop = {
      is_exclude = false
    }
  }

}


exclude {
  if      = local.exclude[local.environment].is_exclude
  actions = ["apply", "destroy"]
}

dependency "iam" {
  config_path = find_in_parent_folders("modules/iam/role")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    roles = {
      ecs-task-execution = {
        arn  = "arn:aws:role:123456789"
        id   = "tmp-id"
        name = "tmp-name"
      }
      app = {
        arn  = "arn:aws:role:123456789"
        id   = "tmp-id"
        name = "tmp-name"
      }
    }
  }
}

inputs = {
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  execution_role_arns = {
    app = dependency.iam.outputs.roles["ecs-task-execution"].arn
  }
  task_role_arns = {
    app = dependency.iam.outputs.roles["app"].arn
  }

  tags = local.tags
}