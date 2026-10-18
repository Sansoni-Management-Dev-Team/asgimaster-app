terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/ecs/service?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  tags        = local.tags_vars.locals[local.environment]
  region      = local.region_vars.locals[local.environment].aws_region

  # on first provision, turn this to false
  # once provisioned, turn this to true
  exclude = {
    develop = {
      is_exclude = true
    }
  }

}

exclude {
  if      = local.exclude[local.environment].is_exclude
  actions = ["plan", "apply", "destroy"]
}

dependency "cluster" {
  config_path = find_in_parent_folders("modules/ecs/cluster")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    clusters = {
      main = {
        arn  = "arn:aws:ecs:123456789"
        id   = "tmp-id"
        name = "tmp-name"
      }
    }
  }
}

dependency "task_def" {
  config_path = find_in_parent_folders("modules/ecs/task_definition")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    task_definitions = {
      app = {
        arn      = "arn:aws:ecs:123456789"
        family   = "app"
        revision = "1"
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

dependency "sg" {
  config_path = find_in_parent_folders("modules/ec2/sg")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    security_groups = {
      app = {
        id   = "sg-123456789"
        name = "sg-name"
        arn  = "arn:aws:ec2:112233"
      }
    }
  }
}

dependency "tg" {
  config_path = find_in_parent_folders("modules/ec2/lb/tg")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    target_groups = {
      app = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
    }
  }
}

inputs = {
  services = {
    app = {
      cluster_arn         = dependency.cluster.outputs.clusters["main"].arn
      task_definition_arn = dependency.task_def.outputs.task_definitions["app"].arn
      desired_count       = 1
      subnet_ids          = values(dependency.subnet.outputs.private_subnets)[*].id
      security_group_ids  = [dependency.sg.outputs.security_groups["app"].id]

      load_balancer = {
        target_group_arn = dependency.tg.outputs.target_groups["app"].arn
        container_name   = "app"
        container_port   = 3000
      }
    }
  }

  tags = local.tags

}