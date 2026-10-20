terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/iam/role"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = get_env("TG_VAR_ENVIRONMENT")

  # The staging feedback mailbox is authorized only for this sender/feedback pair.
  ses_feedback_statements = local.environment == "develop" ? [{
    Sid      = "SendAuthMailWithStagingFeedback"
    Effect   = "Allow"
    Action   = "ses:SendEmail"
    Resource = "arn:aws:ses:ap-southeast-2:806968064090:identity/tom@chillidonut.com"
    Condition = {
      StringEquals = {
        "ses:FromAddress"     = "no-reply@asgi.pajamaprofits.net"
        "ses:FeedbackAddress" = "tom@chillidonut.com"
      }
    }
  }] : []

  tags_vars = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags      = local.tags_vars.locals[local.environment]
}

dependency "oidc" {
  config_path                             = find_in_parent_folders("modules/iam/oidc")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    oidc_providers = {
      github_actions = {
        arn = "arn:aws:oidc::abcdef"
        url = "https://github.com/your-org/your-repo"
      },
    }
  }
}

dependency "permissions" {
  config_path                             = find_in_parent_folders("modules/iam/permissions")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    policies = {
      app = {
        arn = "arn:aws:permission::abcdef"
      },
    }
  }
}

# The API sends passwordless mail through the identity managed by the SES unit.
# Keep this application-specific permission separate from the task execution role.
dependency "ses" {
  config_path                             = find_in_parent_folders("modules/ses")
  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    email_identities = {
      main = {
        arn = "arn:aws:ses:ap-southeast-2:000000000000:identity/example.test"
      }
    }
  }
}

generate "app_ses_send" {
  path      = "app_ses_send.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    resource "aws_iam_role_policy" "app_ses_send" {
      name = "ses-send-auth-mail"
      role = aws_iam_role.this["app"].id
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = concat([{
          Sid      = "SendAuthMailFromVerifiedIdentity"
          Effect   = "Allow"
          Action   = "ses:SendEmail"
          Resource = ${jsonencode(dependency.ses.outputs.email_identities["main"].arn)}
        }], ${jsonencode(local.ses_feedback_statements)})
      })
    }
  EOF
}

inputs = {
  config_file = "${get_terragrunt_dir()}/config/config.yml"
  managed_policy_arns = {
    app = [dependency.permissions.outputs.policies["app"].arn]
  }
  tags = local.tags
}