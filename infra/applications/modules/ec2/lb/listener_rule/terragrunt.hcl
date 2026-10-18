terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/lb/listener_rule?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
}

dependency "tg" {
  config_path = find_in_parent_folders("modules/ec2/lb/tg")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    target_groups = {
      marketplace = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      rabbitmq = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      meilisearch = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      admin-console = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      mobile-app = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      payments = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      audit-log = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      mailer = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
      main-app = {
        arn  = "arn:aws:elasticloadbalancing:123456789"
        name = "my-tg"
      }
    }
  }
}

dependency "listener" {
  config_path = find_in_parent_folders("modules/ec2/lb/listener")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    listeners = {
      http = {
        arn = "arn:aws:elasticloadbalancing:123456789"
      }
      https = {
        arn = "arn:aws:elasticloadbalancing:123456789"
      }
    }
  }
}

inputs = {
  listener_rules = {
    app = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 100
      action = {
        type             = "forward"
        target_group_arn = dependency.tg.outputs.target_groups["app"].arn
      }
      conditions = [
        {
          type   = "host-header"
          values = ["app.asgi.pajamaprofits.net"]
        }
      ]
    }
  }

  tags = local.tags

}