# resources/lb/listener_rule

Creates one or more ALB listener rules. Supports `forward` (to a target group), `redirect`, and `fixed-response` actions, matched by path or host conditions. The listener ARN and target group ARN come from Terragrunt `dependency` blocks.

## Sample Terragrunt Usage

### forward — route matching requests to a target group

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/lb/listener_rule?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "listener" {
  config_path = "../listener"
}

dependency "target_group" {
  config_path = "../target_group"
}

inputs = {
  project     = "myapp"
  environment = "production"

  listener_rules = {
    api = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 100
      action = {
        type             = "forward"
        target_group_arn = dependency.target_group.outputs.target_groups["api"].arn
      }
      conditions = [
        {
          type   = "path-pattern"
          values = ["/api/*"]
        }
      ]
    }
    web = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 200
      action = {
        type             = "forward"
        target_group_arn = dependency.target_group.outputs.target_groups["web"].arn
      }
      conditions = [
        {
          type   = "host-header"
          values = ["app.example.com"]
        }
      ]
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### redirect — send matching requests to a different URL

```hcl
inputs = {
  project     = "myapp"
  environment = "production"

  listener_rules = {
    legacy_redirect = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 50
      action = {
        type = "redirect"
        redirect = {
          host        = "new.example.com"
          path        = "/#{path}"
          query       = "#{query}"
          port        = "443"
          protocol    = "HTTPS"
          status_code = "HTTP_301"
        }
      }
      conditions = [
        {
          type   = "host-header"
          values = ["old.example.com"]
        }
      ]
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### fixed-response — return a static response for matching requests

```hcl
inputs = {
  project     = "myapp"
  environment = "production"

  listener_rules = {
    health_check = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 10
      action = {
        type = "fixed-response"
        fixed_response = {
          content_type = "application/json"
          message_body = "{\"status\":\"ok\"}"
          status_code  = "200"
        }
      }
      conditions = [
        {
          type   = "path-pattern"
          values = ["/health"]
        }
      ]
    }
    maintenance = {
      listener_arn = dependency.listener.outputs.listeners["https"].arn
      priority     = 999
      action = {
        type = "fixed-response"
        fixed_response = {
          content_type = "text/html"
          message_body = "<h1>Under Maintenance</h1>"
          status_code  = "503"
        }
      }
      conditions = [
        {
          type   = "path-pattern"
          values = ["/*"]
        }
      ]
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
| `tags` | Tags applied to all listener rules | `map(string)` | `{}` | no |
| `listener_rules` | Map of listener rules to create (see fields below) | `map(object)` | — | yes |

### listener_rules fields

| Field | Description | Default |
|-------|-------------|---------|
| `listener_arn` | ARN of the listener to attach the rule to | required |
| `priority` | Rule evaluation order (1–50000, lower = higher priority) | required |
| `action.type` | `"forward"`, `"redirect"`, or `"fixed-response"` | required |
| `action.target_group_arn` | Target group ARN (`forward` only) | `null` |
| `action.redirect.port` | Redirect target port | `"443"` |
| `action.redirect.protocol` | Redirect target protocol | `"HTTPS"` |
| `action.redirect.status_code` | HTTP redirect status code | `"HTTP_301"` |
| `action.redirect.host` | Redirect target hostname (`#{host}` preserves original) | `"#{host}"` |
| `action.redirect.path` | Redirect target path (`#{path}` preserves original) | `"/#{path}"` |
| `action.redirect.query` | Redirect query string (`#{query}` preserves original) | `"#{query}"` |
| `action.fixed_response.content_type` | MIME type (`text/plain`, `text/html`, `application/json`) | required for `fixed-response` |
| `action.fixed_response.message_body` | Response body text | `null` |
| `action.fixed_response.status_code` | HTTP status code to return | `"200"` |
| `conditions` | List of match conditions (see below) | required |

### conditions fields

| Field | Description |
|-------|-------------|
| `type` | `"path-pattern"` or `"host-header"` |
| `values` | List of patterns to match (supports `*` and `?` wildcards) |

## Outputs

| Name | Description |
|------|-------------|
| `listener_rules` | Map of rule key to `{ arn, priority }` |
