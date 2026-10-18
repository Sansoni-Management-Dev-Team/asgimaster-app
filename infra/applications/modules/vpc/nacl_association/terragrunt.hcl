terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/vpc/network_acl_association"
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
    private_subnets = {
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

dependency "nacl" {
  config_path = find_in_parent_folders("modules/vpc/nacl")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    network_acls = {
      private = {
        id     = "acl-123456789"
        vpc_id = "vpc-123456789"
      }
      public = {
        id     = "acl-123456789"
        vpc_id = "vpc-123456789"
      }
    }
  }
}

inputs = {
  public_subnets         = dependency.subnet.outputs.public_subnets
  private_subnets        = dependency.subnet.outputs.private_subnets
  public_network_acl_id  = dependency.nacl.outputs.network_acls["public"].id
  private_network_acl_id = dependency.nacl.outputs.network_acls["private"].id
}