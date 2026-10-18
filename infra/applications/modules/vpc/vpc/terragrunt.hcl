terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/vpc/vpc"
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