# resources/lb/listener

Creates one or more ALB listeners. Supports `forward` (to a target group), `redirect` (e.g. HTTP → HTTPS), and `fixed-response` (return a static HTTP response) as the default action. The ALB ARN, certificate ARN, and target group ARN all come from Terragrunt `dependency` blocks.

## Sample Terragrunt Usage

### forward — route traffic to a target group

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/listener?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "alb" {
  config_path = "../alb"
}

dependency "acm" {
  config_path = "../acm"
}

dependency "target_group" {
  config_path = "../target_group"
}

inputs = {
  project     = "myapp"
  environment = "production"

  listeners = {
    https = {
      load_balancer_arn = dependency.alb.outputs.load_balancers["public"].arn
      port              = 443
      protocol          = "HTTPS"
      certificate_arn   = dependency.acm.outputs.certificates["api"].arn
      default_action = {
        type             = "forward"
        target_group_arn = dependency.target_group.outputs.target_groups["api"].arn
      }
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### redirect — send HTTP traffic to HTTPS

```hcl
inputs = {
  project     = "myapp"
  environment = "production"

  listeners = {
    http = {
      load_balancer_arn = dependency.alb.outputs.load_balancers["public"].arn
      port              = 80
      protocol          = "HTTP"
      default_action = {
        type = "redirect"
        redirect = {
          port        = "443"
          protocol    = "HTTPS"
          status_code = "HTTP_301"
        }
      }
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### fixed-response — return a static response (e.g. maintenance page)

```hcl
inputs = {
  project     = "myapp"
  environment = "production"

  listeners = {
    http = {
      load_balancer_arn = dependency.alb.outputs.load_balancers["public"].arn
      port              = 80
      protocol          = "HTTP"
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

  tags = {
    ManagedBy = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `tags` | Tags applied to all listeners | `map(string)` | `{}` | no |
| `listeners` | Map of listeners to create (see fields below) | `map(object)` | — | yes |

### listeners fields

| Field | Description | Default |
|-------|-------------|---------|
| `load_balancer_arn` | ARN of the ALB to attach the listener to | required |
| `port` | Port the listener listens on | required |
| `protocol` | `HTTP` or `HTTPS` | required |
| `certificate_arn` | ACM certificate ARN (HTTPS only) | `null` |
| `ssl_policy` | TLS security policy name (HTTPS only) | `"ELBSecurityPolicy-TLS13-1-2-2021-06"` |
| `default_action.type` | `"forward"`, `"redirect"`, or `"fixed-response"` | required |
| `default_action.target_group_arn` | Target group ARN (`forward` only) | `null` |
| `default_action.redirect.port` | Redirect target port | `"443"` |
| `default_action.redirect.protocol` | Redirect target protocol | `"HTTPS"` |
| `default_action.redirect.status_code` | HTTP redirect status code | `"HTTP_301"` |
| `default_action.fixed_response.content_type` | MIME type of the response (`text/plain`, `text/html`, `application/json`) | required for `fixed-response` |
| `default_action.fixed_response.message_body` | Response body text | `null` |
| `default_action.fixed_response.status_code` | HTTP status code to return | `"200"` |

## Outputs

| Name | Description |
|------|-------------|
| `listeners` | Map of listener key to `{ arn }` |
