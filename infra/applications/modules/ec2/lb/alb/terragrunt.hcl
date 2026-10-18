terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/lb/alb"
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

dependency "subnets" {
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

dependency "sg" {
  config_path = find_in_parent_folders("modules/ec2/sg")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    security_groups = {
      alb = {
        id   = "sg-123456789"
        name = "sg-name"
        arn  = "arn:aws:ec2:112233"
      }
    }
  }
}

inputs = {
  load_balancers = {
    public = {
      internal           = false
      security_group_ids = [dependency.sg.outputs.security_groups["alb"].id]
      subnet_ids         = values(dependency.subnets.outputs.public_subnets)[*].id
    }
  }

  tags = local.tags
}