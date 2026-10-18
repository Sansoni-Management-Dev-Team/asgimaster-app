terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/vpc/vpc?ref=0.0.6"
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
  vpcs = {
    main = {
      cidr_block = "10.3.0.0/16"
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-vpc-${local.tags.environment}" }
      )
    }
  }
}