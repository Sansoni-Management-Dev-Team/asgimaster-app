locals {
  config     = yamldecode(templatefile(var.config_file, { domain = var.domain }))
  config_dir = dirname(var.config_file)
  buckets    = local.config.buckets

  bucket_names = {
    for key, b in local.buckets :
    key => try(b.name, "") != "" ? b.name : "${var.project}-${key}-${var.environment}"
  }

  # Defaults to fully blocked (private bucket / CDN origin). Set to false
  # only for buckets that must serve a public static website directly.
  public_access_block = {
    for key, b in local.buckets : key => try(b.block_public_access, true)
  }
}

data "aws_caller_identity" "this" {}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket        = local.bucket_names[each.key]
  force_destroy = try(each.value.force_destroy, false)

  tags = merge(var.tags, try(each.value.tags, {}), {
    Name = local.bucket_names[each.key]
  })
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = { for k, b in local.buckets : k => b if try(b.versioning, false) }

  bucket = aws_s3_bucket.this[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.buckets

  bucket = aws_s3_bucket.this[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = try(each.value.kms_key_id, null) != null ? "aws:kms" : "AES256"
      kms_master_key_id = try(each.value.kms_key_id, null)
    }
    bucket_key_enabled = try(each.value.kms_key_id, null) != null
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = local.buckets

  bucket = aws_s3_bucket.this[each.key].id

  block_public_acls       = local.public_access_block[each.key]
  block_public_policy     = local.public_access_block[each.key]
  ignore_public_acls      = local.public_access_block[each.key]
  restrict_public_buckets = local.public_access_block[each.key]
}

resource "aws_s3_bucket_website_configuration" "this" {
  for_each = { for k, b in local.buckets : k => b if try(b.website, null) != null }

  bucket = aws_s3_bucket.this[each.key].id

  dynamic "index_document" {
    for_each = try(each.value.website.redirect_all_requests_to, null) == null ? [1] : []
    content {
      suffix = try(each.value.website.index_document, "index.html")
    }
  }

  dynamic "error_document" {
    for_each = try(each.value.website.redirect_all_requests_to, null) == null && try(each.value.website.error_document, null) != null ? [1] : []
    content {
      key = each.value.website.error_document
    }
  }

  dynamic "redirect_all_requests_to" {
    for_each = try(each.value.website.redirect_all_requests_to, null) != null ? [1] : []
    content {
      host_name = each.value.website.redirect_all_requests_to
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "this" {
  for_each = { for k, b in local.buckets : k => b if length(try(b.cors_rules, [])) > 0 }

  bucket = aws_s3_bucket.this[each.key].id

  dynamic "cors_rule" {
    for_each = each.value.cors_rules
    content {
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      allowed_headers = try(cors_rule.value.allowed_headers, [])
      expose_headers  = try(cors_rule.value.expose_headers, [])
      max_age_seconds = try(cors_rule.value.max_age_seconds, null)
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = { for k, b in local.buckets : k => b if length(try(b.lifecycle_rules, [])) > 0 }

  bucket = aws_s3_bucket.this[each.key].id

  dynamic "rule" {
    for_each = each.value.lifecycle_rules
    content {
      id     = rule.value.id
      status = try(rule.value.enabled, true) ? "Enabled" : "Disabled"

      filter {
        prefix = try(rule.value.prefix, "")
      }

      dynamic "transition" {
        for_each = try(rule.value.transitions, [])
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      dynamic "expiration" {
        for_each = try(rule.value.expiration_days, null) != null ? [1] : []
        content {
          days = rule.value.expiration_days
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = try(rule.value.noncurrent_version_expiration_days, null) != null ? [1] : []
        content {
          noncurrent_days = rule.value.noncurrent_version_expiration_days
        }
      }
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = { for k, b in local.buckets : k => b if try(b.policy, null) != null }

  bucket = aws_s3_bucket.this[each.key].id
  policy = templatefile("${local.config_dir}/${each.value.policy}", merge({
    bucket_name = local.bucket_names[each.key]
    bucket_arn  = aws_s3_bucket.this[each.key].arn
    region      = var.region
    aws_account = data.aws_caller_identity.this.account_id
    project     = var.project
    environment = var.environment
  }, try(each.value.template_vars, {}), var.extra_template_vars))

  depends_on = [aws_s3_bucket_public_access_block.this]
}
