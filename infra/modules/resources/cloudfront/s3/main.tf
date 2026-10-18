locals {
  config        = yamldecode(file(var.config_file))
  distributions = local.config.distributions

  # Flatten origins per distribution so each origin (and its bucket lookup
  # and OAC) gets a stable for_each key: "<dist_key>:<origin_key>".
  origins = merge([
    for dist_key, dist in local.distributions : {
      for origin_key, origin in dist.origins :
      "${dist_key}:${origin_key}" => origin
    }
  ]...)

  acm_certificate_arns = {
    for dist_key, dist in local.distributions :
    dist_key => try(var.acm_certificate_arn_overrides[dist_key], try(dist.acm_certificate_arn, null))
  }
}

# Looks up each origin bucket by name so callers only pass a bucket_name
# string in config.yml - the regional domain name CloudFront needs is
# resolved here via Terraform's own data source, with no Terragrunt
# `dependency` block (and its mock_outputs) required. region defaults to
# var.region (us-east-1, for CloudFront/ACM) but the bucket usually lives
# elsewhere, so each origin can set bucket_region to override just this
# lookup - the AWS provider resolves it per-resource without a provider
# alias.
data "aws_s3_bucket" "this" {
  for_each = local.origins

  bucket = "${var.project}-${each.value.bucket_name}-${var.environment}"
  region = try(each.value.bucket_region, var.region)
}

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
  for_each = { for key, o in local.origins : key => o if try(o.manage_bucket_policy, true) }

  bucket = data.aws_s3_bucket.this[each.key].id
  region = try(each.value.bucket_region, var.region)
}

locals {
  # Sids this module itself will (re)write below - stripped out of the
  # fetched existing policy before merging so repeated applies replace
  # this module's own prior statements instead of duplicating them.
  managed_policy_sids = {
    for key, o in local.origins :
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
  for_each = local.origins

  name                              = "${var.project}-${replace(each.key, ":", "-")}-${var.environment}"
  description                       = "OAC for ${each.key}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
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
      origin_id                = origin.key
      domain_name              = data.aws_s3_bucket.this["${each.key}:${origin.key}"].bucket_regional_domain_name
      origin_path              = try(origin.value.origin_path, "")
      origin_access_control_id = aws_cloudfront_origin_access_control.this["${each.key}:${origin.key}"].id

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
  for_each = { for key, o in local.origins : key => o if try(o.manage_bucket_policy, true) }

  bucket = data.aws_s3_bucket.this[each.key].id
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
          Resource  = "${data.aws_s3_bucket.this[each.key].arn}/*"
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
