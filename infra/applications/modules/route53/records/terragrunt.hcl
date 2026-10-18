terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/route53/record?ref=0.0.12"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")
  domain      = read_terragrunt_config(find_in_parent_folders("domain.hcl")).locals[local.environment]
}

dependency "hosted_zone" {
  config_path = find_in_parent_folders("modules/route53/hosted_zone")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    hosted_zones = {
      default = {
        id   = "Z01231DQW665"
        arn  = "arn:aws:route53:::hostedzone/Z01231DQW665"
        name = "domain.com"
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
        zone_id  = "Z1GM3OXH4ZPM65"
        name     = "my_lb"
      }
    }
  }
}

dependency "ses" {
  config_path = find_in_parent_folders("modules/ses")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    email_identities = {
      main = {
        arn              = "arn:aws:ses:ap-southeast-2:123456789:identity/example.com"
        email_identity   = "example.com"
        identity_type    = "DOMAIN"
        mail_from_domain = "bounce.example.com"
      }
    }
  }
}

inputs = {
  records = merge(
    {
      app = {
        zone_id = dependency.hosted_zone.outputs.hosted_zones["default"].id
        name    = local.domain.app_host
        type    = "CNAME"
        ttl     = 300
        values  = [dependency.alb.outputs.load_balancers.public.dns_name]
      }

      asgi-dmarc = {
        zone_id = dependency.hosted_zone.outputs.hosted_zones["default"].id
        name    = "_dmarc.${local.domain.zone_name}"
        type    = "TXT"
        values  = ["v=DMARC1; p=none;"]
      }
    },
    {
      for key, record in dependency.ses.outputs.dns_records : key => merge(record, {
        zone_id = dependency.hosted_zone.outputs.hosted_zones["default"].id
      })
    }
  )
}
