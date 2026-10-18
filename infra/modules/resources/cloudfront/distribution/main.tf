locals {
  config        = yamldecode(file(var.config_file))
  distributions = local.config.distributions

  # Flatten origins per distribution so each origin (and its bucket/ALB
  # lookup and OAC) gets a stable for_each key: "<dist_key>:<origin_key>".
  origins = merge([
    for dist_key, dist in local.distributions : {
      for origin_key, origin in dist.origins :
      "${dist_key}:${origin_key}" => origin
    }
  ]...)

  s3_origins     = { for key, o in local.origins : key => o if try(o.type, "custom") == "s3" }
  alb_origins    = { for key, o in local.origins : key => o if try(o.type, "custom") == "alb" }
  custom_origins = { for key, o in local.origins : key => o if !contains(["s3", "alb"], try(o.type, "custom")) }

  acm_certificate_arns = {
    for dist_key, dist in local.distributions :
    dist_key => try(var.acm_certificate_arn_overrides[dist_key], try(dist.acm_certificate_arn, null))
  }
}

# S3 origins no longer resolve their bucket by guessing its name and
# calling the aws_s3_bucket data source - that made the bucket's existence
# an implicit requirement this module couldn't express to Terragrunt.
# Instead the caller wires a real `dependency "s3"` block's outputs
# through var.s3_bucket_overrides, so Terragrunt's own dependency graph
# (not an AWS API guess at plan time) is what guarantees the bucket
# exists first. See variables.tf for the shape.

# Reads whatever policy is already attached to the bucket (e.g. one set by
# resources/s3) so aws_s3_bucket_policy.this below can fold its
# CloudFront-grant statement into it instead of replacing it outright -
# aws_s3_bucket_policy always writes a bucket's *entire* policy document,
# so without this read first, this module's apply would silently drop
# every other statement on the bucket. This means the bucket must already
# have SOME policy attached (e.g. via resources/s3's `policy` field)
# before this module's first apply; a bucket with no policy at all makes
# this data source error.
data "aws_s3_bucket_policy" "existing" {
  for_each = { for key, o in local.s3_origins : key => o if try(o.manage_bucket_policy, true) }

  bucket = var.s3_bucket_overrides[each.key].id
  region = try(each.value.bucket_region, var.region)
}

locals {
  # Sids this module itself will (re)write below - stripped out of the
  # fetched existing policy before merging so repeated applies replace
  # this module's own prior statements instead of duplicating them.
  managed_policy_sids = {
    for key, o in local.s3_origins :
    key => concat(
      ["AllowCloudFrontServicePrincipal"],
      [for s in try(o.extra_policy_statements, []) : s.Sid]
    )
  }

  existing_policy_statements = {
    for key, p in data.aws_s3_bucket_policy.existing :
    key => [
      for s in try(jsondecode(p.policy).Statement, []) :
      s if !contains(local.managed_policy_sids[key], s.Sid)
    ]
  }
}

resource "aws_cloudfront_origin_access_control" "this" {
  for_each = local.s3_origins

  name                              = "${var.project}-${replace(each.key, ":", "-")}-${var.environment}"
  description                       = "OAC for ${each.key}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ALB origins resolve the same way s3 origins do above: no more guessing
# the ALB's name and calling the aws_lb data source at plan time. An ALB's
# dns_name is only known once resources/lb/alb has actually applied, so
# it must come in through origin_domain_name_overrides from a real
# `dependency "alb"` block - the same mechanism a custom origin already
# uses for a Terragrunt-layer-only domain name (e.g. an API Gateway invoke
# domain).

locals {
  # Every origin's resolved domain name, regardless of type. s3 defaults
  # to its bucket's regional domain name from var.s3_bucket_overrides, but
  # config.yml can set an explicit domain_name to override that. alb and
  # custom origins have no in-module lookup at all, so domain_name is
  # required for them directly in config.yml (a placeholder is fine) - see
  # origin_domain_name_overrides below for the usual way an alb origin's
  # real value (or an ALB-fronting custom domain, for certificate
  # validation) actually gets in.
  resolved_origin_domain_names = merge(
    { for key, o in local.s3_origins : key => try(o.domain_name, var.s3_bucket_overrides[key].bucket_regional_domain_name) },
    { for key, o in local.alb_origins : key => o.domain_name },
    { for key, o in local.custom_origins : key => o.domain_name },
  )

  origin_domain_names = {
    for key, name in local.resolved_origin_domain_names :
    key => try(var.origin_domain_name_overrides[key], name)
  }
}

resource "aws_cloudfront_distribution" "this" {
  for_each = local.distributions

  enabled             = try(each.value.enabled, true)
  is_ipv6_enabled     = try(each.value.is_ipv6_enabled, true)
  comment             = try(each.value.comment, "${var.project}-${each.key}-${var.environment}")
  default_root_object = try(each.value.default_root_object, null)
  price_class         = try(each.value.price_class, "PriceClass_100")
  aliases             = try(each.value.aliases, [])
  web_acl_id          = try(each.value.web_acl_id, null)
  http_version        = try(each.value.http_version, "http2")
  wait_for_deployment = try(each.value.wait_for_deployment, true)
  retain_on_delete    = try(each.value.retain_on_delete, false)

  dynamic "origin" {
    for_each = each.value.origins
    content {
      origin_id   = origin.key
      domain_name = local.origin_domain_names["${each.key}:${origin.key}"]
      origin_path = try(origin.value.origin_path, "")

      # OAC (not the legacy OAI) is the only way this module fronts a
      # private S3 bucket, so an s3-type origin needs neither
      # s3_origin_config nor custom_origin_config - origin_access_control_id
      # alone is enough. alb and custom types always talk HTTP(S), so they
      # get custom_origin_config below instead.
      origin_access_control_id = try(origin.value.type, "custom") == "s3" ? aws_cloudfront_origin_access_control.this["${each.key}:${origin.key}"].id : null

      dynamic "custom_origin_config" {
        for_each = try(origin.value.type, "custom") != "s3" ? [1] : []
        content {
          http_port                = try(origin.value.http_port, 80)
          https_port               = try(origin.value.https_port, 443)
          origin_protocol_policy   = try(origin.value.origin_protocol_policy, "https-only")
          origin_ssl_protocols     = try(origin.value.origin_ssl_protocols, ["TLSv1.2"])
          origin_read_timeout      = try(origin.value.origin_read_timeout, 30)
          origin_keepalive_timeout = try(origin.value.origin_keepalive_timeout, 5)
        }
      }

      dynamic "custom_header" {
        for_each = try(origin.value.custom_headers, {})
        content {
          name  = custom_header.key
          value = custom_header.value
        }
      }
    }
  }

  default_cache_behavior {
    target_origin_id           = each.value.default_cache_behavior.target_origin_id
    viewer_protocol_policy     = try(each.value.default_cache_behavior.viewer_protocol_policy, "redirect-to-https")
    allowed_methods            = try(each.value.default_cache_behavior.allowed_methods, ["GET", "HEAD"])
    cached_methods             = try(each.value.default_cache_behavior.cached_methods, ["GET", "HEAD"])
    compress                   = try(each.value.default_cache_behavior.compress, true)
    cache_policy_id            = try(each.value.default_cache_behavior.cache_policy_id, null)
    origin_request_policy_id   = try(each.value.default_cache_behavior.origin_request_policy_id, null)
    response_headers_policy_id = try(each.value.default_cache_behavior.response_headers_policy_id, null)

    min_ttl     = try(each.value.default_cache_behavior.cache_policy_id, null) == null ? try(each.value.default_cache_behavior.min_ttl, 0) : null
    default_ttl = try(each.value.default_cache_behavior.cache_policy_id, null) == null ? try(each.value.default_cache_behavior.default_ttl, 3600) : null
    max_ttl     = try(each.value.default_cache_behavior.cache_policy_id, null) == null ? try(each.value.default_cache_behavior.max_ttl, 86400) : null

    dynamic "forwarded_values" {
      for_each = try(each.value.default_cache_behavior.cache_policy_id, null) == null ? [1] : []
      content {
        query_string = try(each.value.default_cache_behavior.forward_query_string, false)
        cookies {
          forward = try(each.value.default_cache_behavior.forward_cookies, "none")
        }
      }
    }

    dynamic "function_association" {
      for_each = try(each.value.default_cache_behavior.function_associations, [])
      content {
        event_type = function_association.value.event_type
        function_arn = try(
          var.function_arn_overrides["${each.key}:default:${function_association.value.event_type}"],
          try(function_association.value.function_arn, null)
        )
      }
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = try(each.value.ordered_cache_behaviors, {})
    content {
      path_pattern               = ordered_cache_behavior.value.path_pattern
      target_origin_id           = ordered_cache_behavior.value.target_origin_id
      viewer_protocol_policy     = try(ordered_cache_behavior.value.viewer_protocol_policy, "redirect-to-https")
      allowed_methods            = try(ordered_cache_behavior.value.allowed_methods, ["GET", "HEAD"])
      cached_methods             = try(ordered_cache_behavior.value.cached_methods, ["GET", "HEAD"])
      compress                   = try(ordered_cache_behavior.value.compress, true)
      cache_policy_id            = try(ordered_cache_behavior.value.cache_policy_id, null)
      origin_request_policy_id   = try(ordered_cache_behavior.value.origin_request_policy_id, null)
      response_headers_policy_id = try(ordered_cache_behavior.value.response_headers_policy_id, null)

      min_ttl     = try(ordered_cache_behavior.value.cache_policy_id, null) == null ? try(ordered_cache_behavior.value.min_ttl, 0) : null
      default_ttl = try(ordered_cache_behavior.value.cache_policy_id, null) == null ? try(ordered_cache_behavior.value.default_ttl, 3600) : null
      max_ttl     = try(ordered_cache_behavior.value.cache_policy_id, null) == null ? try(ordered_cache_behavior.value.max_ttl, 86400) : null

      dynamic "forwarded_values" {
        for_each = try(ordered_cache_behavior.value.cache_policy_id, null) == null ? [1] : []
        content {
          query_string = try(ordered_cache_behavior.value.forward_query_string, false)
          cookies {
            forward = try(ordered_cache_behavior.value.forward_cookies, "none")
          }
        }
      }

      dynamic "function_association" {
        for_each = try(ordered_cache_behavior.value.function_associations, [])
        content {
          event_type = function_association.value.event_type
          function_arn = try(
            var.function_arn_overrides["${each.key}:${ordered_cache_behavior.key}:${function_association.value.event_type}"],
            try(function_association.value.function_arn, null)
          )
        }
      }
    }
  }

  dynamic "custom_error_response" {
    for_each = try(each.value.custom_error_responses, [])
    content {
      error_code            = custom_error_response.value.error_code
      response_code         = try(custom_error_response.value.response_code, null)
      response_page_path    = try(custom_error_response.value.response_page_path, null)
      error_caching_min_ttl = try(custom_error_response.value.error_caching_min_ttl, 10)
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = try(each.value.geo_restriction.type, "none")
      locations        = try(each.value.geo_restriction.locations, [])
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.acm_certificate_arns[each.key] == null
    acm_certificate_arn            = local.acm_certificate_arns[each.key]
    ssl_support_method             = local.acm_certificate_arns[each.key] != null ? "sni-only" : null
    minimum_protocol_version       = try(each.value.minimum_protocol_version, "TLSv1.2_2021")
  }

  tags = merge(var.tags, try(each.value.tags, {}), {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

# Grants this distribution's OAC read access on its origin bucket, merged
# on top of local.existing_policy_statements above so whatever the bucket
# already had (e.g. from resources/s3) survives this module's apply
# instead of being replaced by just this grant. The distribution ARN the
# grant's condition needs is created earlier in this same apply, so there
# is no dependency in the other direction either.
#
# Because the merge is a plan-time read of the bucket's *current* policy,
# it only reflects whatever last wrote that policy - if resources/s3 (or
# anything else) applies again afterwards with its own static policy, it
# will overwrite this module's merged result the same way this resource
# overwrote resources/s3's. Keep this module's apply last in the usual
# apply order for a given bucket.
resource "aws_s3_bucket_policy" "this" {
  for_each = { for key, o in local.s3_origins : key => o if try(o.manage_bucket_policy, true) }

  bucket = var.s3_bucket_overrides[each.key].id
  region = try(each.value.bucket_region, var.region)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      local.existing_policy_statements[each.key],
      [
        {
          Sid       = "AllowCloudFrontServicePrincipal"
          Effect    = "Allow"
          Principal = { Service = "cloudfront.amazonaws.com" }
          Action    = "s3:GetObject"
          Resource  = "${var.s3_bucket_overrides[each.key].arn}/*"
          Condition = {
            StringEquals = {
              "AWS:SourceArn" = aws_cloudfront_distribution.this[split(":", each.key)[0]].arn
            }
          }
        }
      ],
      try(each.value.extra_policy_statements, [])
    )
  })
}
