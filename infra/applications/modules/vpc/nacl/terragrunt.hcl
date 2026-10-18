terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/vpc/network_acl?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
}

dependency "vpc" {
  config_path = find_in_parent_folders("modules/vpc/vpc")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    vpcs = {
      main = {
        id         = "vpc-123456789"
        cidr_block = "10.0.0.0/16"
      }
    }
  }
}

inputs = {
  network_acls = {
    public = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id,
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-public-nacl-${local.tags.environment}" }
      )
    }
    private = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id,
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-private-nacl-${local.tags.environment}" }
      )
    }
  }
}