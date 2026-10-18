terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/rds/aurora_serverless?ref=0.0.6"
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
    database_subnets = {
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
      rds = {
        id   = "sg-123456789"
        name = "sg-name"
        arn  = "arn:aws:ec2:112233"
      }
    }
  }
}

dependency "kms" {
  config_path = find_in_parent_folders("modules/kms")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    keys = {
      rds = {
        arn = "arn:aws:ec2:112233"
      }
    }
  }
}

inputs = {
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  subnet_ids            = values(dependency.subnet.outputs.database_subnets)[*].id
  security_group_ids    = [dependency.sg.outputs.security_groups["rds"].id]
  kms_key_id            = dependency.kms.outputs.keys["rds"].arn
  credentials_secret_id = "${local.tags.project}-secrets-${local.tags.environment}"

  tags = local.tags
}