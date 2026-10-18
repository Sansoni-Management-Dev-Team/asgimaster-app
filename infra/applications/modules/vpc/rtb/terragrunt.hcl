terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/vpc/route_table?ref=0.0.6"
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

dependency "natgw" {
  config_path = find_in_parent_folders("modules/vpc/natgw")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    nat_gateways = {
      main = {
        subnet_id = "subnet-123456789"
        id        = "nat-987654321"
        public_ip = "13.228.171.174"
      }
    }
  }
}

dependency "igw" {
  config_path = find_in_parent_folders("modules/vpc/igw")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    internet_gateways = {
      main = {
        id     = "igw-987654321"
        vpc_id = "vpc-123456789"
      }
    }
  }
}

inputs = {
  route_tables = {
    public = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block = "0.0.0.0/0"
          gateway_id = dependency.igw.outputs.internet_gateways["main"].id
        }
      }
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-rtb-public-${local.tags.environment}" }
      )
    }
    private = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block     = "0.0.0.0/0"
          nat_gateway_id = dependency.natgw.outputs.nat_gateways["main"].id
        }
      }
      tags = merge(
        local.tags,
        { Name = "${local.tags.project}-rtb-private-${local.tags.environment}" }
      )
    }
  }
}