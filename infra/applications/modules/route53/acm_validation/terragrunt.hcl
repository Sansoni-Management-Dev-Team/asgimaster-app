terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/route53/record?ref=0.0.6"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

dependency "route53" {
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

dependency "acm_ap_southeast_2" {
  config_path                             = find_in_parent_folders("modules/acm/ap-southeast-2")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    certificates = {
      scaling = {
        arn                       = "arn:aws:acm:::certificate/mock"
        domain_name               = "domain.com"
        subject_alternative_names = []
        domain_validation_options = []
        status                    = "PENDING_VALIDATION"
      }
    }
  }
}

dependency "acm_us_east_1" {
  config_path                             = find_in_parent_folders("modules/acm/us-east-1")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    certificates = {
      scaling = {
        arn                       = "arn:aws:acm:::certificate/mock"
        domain_name               = "domain.com"
        subject_alternative_names = []
        domain_validation_options = []
        status                    = "PENDING_VALIDATION"
      }
    }
  }
}

inputs = {
  records = {
    for record_name, dvos in {
      for dvo in flatten([
        for cert_key, cert in merge(
          dependency.acm_ap_southeast_2.outputs.certificates,
          dependency.acm_us_east_1.outputs.certificates,
          ) : [
          for dvo in cert.domain_validation_options : dvo
        ]
      ]) : dvo.resource_record_name => dvo...
      } : record_name => {
      zone_id = dependency.route53.outputs.hosted_zones["default"].id
      name    = record_name
      type    = dvos[0].resource_record_type
      ttl     = 60
      values  = [dvos[0].resource_record_value]
    }
  }
}

