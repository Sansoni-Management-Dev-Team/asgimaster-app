terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/lb/listener"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
}

dependency "acm" {
  config_path = find_in_parent_folders("modules/acm/ap-southeast-2")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    certificates = {
      scaling = {
        arn         = "arn:aws:acm:123456789"
        domain_name = "test.com"
      }
    }
  }
}

dependency "alb" {
  config_path = find_in_parent_folders("modules/ec2/lb/alb")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    load_balancers = {
      public = {
        arn      = "arn:aws:elasticloadbalancing:123456789"
        dns_name = "elb.amazonaws.com"
      }
    }
  }
}

inputs = {
  listeners = {
    http = {
      load_balancer_arn = dependency.alb.outputs.load_balancers["public"].arn
      port              = 80
      protocol          = "HTTP"
      default_action = {
        type = "redirect"
      }
    }
    https = {
      load_balancer_arn = dependency.alb.outputs.load_balancers["public"].arn
      port              = 443
      protocol          = "HTTPS"
      certificate_arn   = dependency.acm.outputs.certificates["scaling"].arn
      default_action = {
        type = "fixed-response"
        fixed_response = {
          content_type = "text/plain"
          message_body = "Service unavailable. Please try again later."
          status_code  = "503"
        }
      }
    }
  }

  tags = local.tags
}