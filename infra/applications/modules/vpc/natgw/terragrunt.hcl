terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/vpc/nat_gateway"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))

  tags   = local.tags_vars.locals[local.environment]
  region = local.region_vars.locals[local.environment].aws_region
}

dependency "eip" {
  config_path = find_in_parent_folders("modules/vpc/eip")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    eips = {
      nat = {
        allocation_id = "eipalloc-123456789"
        id            = "eipalloc-987654321"
        public_ip     = "13.228.171.174"
      }
    }
  }
}

dependency "subnet" {
  config_path = find_in_parent_folders("modules/vpc/subnets")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    public_subnets = {
      "${local.region}a" = {
        availability_zone = "ap-southeast-1a"
        cidr_block        = "10.0.1.0/24"
        id                = "subnet-123456789"
        vpc_id            = "vpc-123456789"
      }
      "${local.region}b" = {
        availability_zone = "ap-southeast-1a"
        cidr_block        = "10.0.1.0/24"
        id                = "subnet-123456789"
        vpc_id            = "vpc-123456789"
      }
    }
  }
}

inputs = {
  nat_gateways = {
    main = {
      allocation_id = dependency.eip.outputs.eips["nat"].allocation_id
      subnet_id     = dependency.subnet.outputs.public_subnets["${local.region}a"].id
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-natgw-${local.tags.environment}" }
      )
    }
  }
}