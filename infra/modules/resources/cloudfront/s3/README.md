# resources/cloudfront/s3

Creates one or more CloudFront distributions fronting private S3 buckets via Origin Access Control (OAC) from a YAML config file. This is a narrower, S3-only sibling of `resources/cloudfront/distribution`: every origin in `config.yml` is a bucket, identified by plain `bucket_name` string rather than a domain name.

The module looks up each bucket with the `aws_s3_bucket` data source and reads its `bucket_regional_domain_name` directly - it does not accept a domain name or override input for it. That means a caller never needs a Terragrunt `dependency "s3" { ... }` block (or the `mock_outputs` that block requires) just to plug an S3 origin into this module; the bucket only needs to already exist by the time this module is applied.

The module's own `region` (used for the CloudFront distribution and, indirectly, for resolving `acm_certificate_arn`) defaults to `us-east-1`, since CloudFront only reads ACM certificates from that region. An origin bucket rarely lives in `us-east-1` too, so each origin can set its own `bucket_region` in `config.yml`; the `aws_s3_bucket` lookup and the `aws_s3_bucket_policy` this module attaches both use it (via the AWS provider's per-resource `region` argument, no provider alias needed) instead of falling back to `var.region`.

The module also grants the distribution's OAC `s3:GetObject` on its origin bucket, scoped to that distribution's ARN via a `SourceArn` condition. Since the distribution is created in this same apply, there's no dependency in the other direction either - the bucket named by `bucket_name` just needs to already exist, e.g. created by `resources/s3` (its `cdn_origin` sample is a starting point).

`aws_s3_bucket_policy` always sets a bucket's *entire* policy document - it has no way to append a single statement. So before writing its own policy, this module first reads the bucket's current policy (via the `aws_s3_bucket_policy` data source) and folds the CloudFront grant into it, keeping every other statement that was already there (e.g. a `DenyInsecureTransport` statement set by `resources/s3`'s `policy` field). Statements are merged by `Sid`: a re-apply strips out and rewrites only the Sids this module itself manages (`AllowCloudFrontServicePrincipal` plus whatever's listed in `extra_policy_statements`), so repeated applies don't pile up duplicates.

This means **the bucket must already have some policy attached before this module's first apply** - the data source errors on a bucket with no policy at all. If the bucket has nothing else to declare, give it a minimal placeholder policy in `resources/s3`'s config (e.g. the `enforce_ssl.json` sample) rather than leaving `policy` unset.

It also means **apply order matters**: the merge only reflects whichever policy was live at the time this module last applied. If `resources/s3` (or anything else with its own `aws_s3_bucket_policy` on the same bucket) applies again afterwards, it will overwrite this module's merged result with its own static policy, the same way this module's apply overwrote it originally - the CloudFront grant would disappear until this module applies again. Keep this module the last one to touch a given bucket's policy in your normal apply order. Set an origin's `manage_bucket_policy: false` to opt out entirely (e.g. if something else already owns that bucket's policy end-to-end).

If you need non-S3 origins (ALB, API Gateway, a third-party domain, an S3 static website endpoint) alongside or instead of a private S3 bucket, use `resources/cloudfront/distribution` instead.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/cloudfront/s3?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "acm" {
  config_path = "../acm"

  # Lets `plan`/`validate` succeed before resources/acm has been applied
  # for the first time.
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs = {
    certificates = {
      cdn = { arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000" }
    }
  }
}

dependency "cloudfront_function" {
  config_path = "../cloudfront-function"

  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs = {
    functions = {
      viewer-request-redirect = { arn = "arn:aws:cloudfront::123456789012:function/00000000-0000-0000-0000-000000000000" }
    }
  }
}

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"

  # No dependency block on resources/s3 in either direction - bucket_name
  # in config.yml is enough for the module to resolve the bucket's
  # regional domain name via a data source, and it attaches the
  # OAC-grant bucket policy itself in the same apply.

  # Same reasoning as resources/cloudfront/distribution's acm_certificate_arn_overrides - the
  # ARN from a resources/acm dependency block, since config_file is read
  # directly by Terraform and never sees Terragrunt's ${dependency...}
  # interpolation.
  acm_certificate_arn_overrides = {
    static_site = dependency.acm.outputs.certificates["cdn"].arn
  }

  # Same reasoning, for a CloudFront Function's ARN from a
  # resources/cloudfront/function dependency block. Keyed by
  # "<dist_key>:<cache_behavior_key>:<event_type>" - "default" is the
  # cache_behavior_key for default_cache_behavior.
  function_arn_overrides = {
    "static_site:default:viewer-request" = dependency.cloudfront_function.outputs.functions["viewer-request-redirect"].arn
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
distributions:
  # Single-page app backed by a private S3 bucket via OAC. bucket_name is
  # just the bucket's name - the module looks up its
  # bucket_regional_domain_name with a data source, then reads whatever
  # policy is already on the bucket and folds the OAC-grant statement into
  # it, so no Terragrunt `dependency` block on resources/s3 is needed here.
  # The bucket must already have some policy attached (e.g. via
  # resources/s3's `policy` field) before this module's first apply.
  static_site:
    comment: "Static site backed by a private S3 bucket via OAC"
    default_root_object: index.html
    aliases:
      - assets.example.com
    # acm_certificate_arn supplied via acm_certificate_arn_overrides.
    origins:
      s3:
        bucket_name: myapp-cdn-origin-production
        # The module's own provider region (var.region) is us-east-1, for
        # CloudFront/ACM - this bucket actually lives in ap-southeast-2, so
        # the lookup and bucket policy for it are overridden per-origin.
        bucket_region: ap-southeast-2
    default_cache_behavior:
      target_origin_id: s3
      viewer_protocol_policy: redirect-to-https
      allowed_methods: ["GET", "HEAD"]
      cached_methods: ["GET", "HEAD"]
      cache_policy_id: 658327ea-f89d-4fab-a63d-7e88639e58f6 # AWS managed CachingOptimized
      # function_arn here is a placeholder - the real ARN is supplied via
      # the module-level function_arn_overrides input (see Sample
      # Terragrunt Usage above) since it comes from a
      # resources/cloudfront/function dependency block.
      function_associations:
        - event_type: viewer-request
          function_arn: arn:aws:cloudfront::123456789012:function/viewer-request-redirect
    # SPA-style error pages: S3 (via OAC) returns 403, not 404, for a
    # missing key, so both codes are mapped back to index.html and given
    # to the browser as a 200 so client-side routing can take over.
    custom_error_responses:
      - error_code: 403
        response_code: 200
        response_page_path: /index.html
        error_caching_min_ttl: 10
      - error_code: 404
        response_code: 200
        response_page_path: /index.html
        error_caching_min_ttl: 10

  # Docs site with its own static 404 page instead of SPA-style fallback.
  docs_site:
    comment: "Docs site backed by a private S3 bucket via OAC"
    default_root_object: index.html
    origins:
      s3:
        bucket_name: myapp-docs-production
        # Folded into the same document as the CloudFront grant and
        # whatever else was already on the bucket - each needs a unique
        # Sid so re-applies replace rather than duplicate it.
        extra_policy_statements:
          - Sid: AllowInternalReadForAudit
            Effect: Allow
            Principal:
              AWS: arn:aws:iam::123456789012:role/audit-readonly
            Action: s3:GetObject
            Resource: arn:aws:s3:::myapp-docs-production/*
    default_cache_behavior:
      target_origin_id: s3
      viewer_protocol_policy: redirect-to-https
      allowed_methods: ["GET", "HEAD"]
      cached_methods: ["GET", "HEAD"]
      cache_policy_id: 658327ea-f89d-4fab-a63d-7e88639e58f6
    custom_error_responses:
      - error_code: 404
        response_code: 404
        response_page_path: /404.html
        error_caching_min_ttl: 300
```

> `acm_certificate_arn` must reference a certificate in `us-east-1` regardless of the distribution's own region — CloudFront only reads ACM certificates from that region. Create it via `resources/acm` with `region = "us-east-1"`.

> A bucket fronted by this module needs no `policy` set in its `resources/s3` config at all, and no Terragrunt `dependency` block or two-pass apply in either direction — this module creates the OAC-grant policy itself in the same apply as the distribution. `resources/cloudfront/distribution` behaves the same way for its `s3`-type origins.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider (CloudFront and its ACM certificate must be managed from `us-east-1`) | `string` | `"us-east-1"` | no |
| `project` | Project name, used as a prefix for distribution and OAC names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `tags` | Tags applied to all distributions | `map(string)` | `{}` | no |
| `acm_certificate_arn_overrides` | Map of `distribution_key` to an ACM certificate ARN overriding that distribution's `config.yml` `acm_certificate_arn`. For the ARN from a `resources/acm` `dependency` block | `map(string)` | `{}` | no |
| `function_arn_overrides` | Map of `"<distribution_key>:<cache_behavior_key>:<event_type>"` to a CloudFront Function ARN overriding the matching `config.yml` `function_associations` entry's `function_arn`. `cache_behavior_key` is `"default"` for `default_cache_behavior`, or the key from `ordered_cache_behaviors`. For the ARN from a `resources/cloudfront/function` `dependency` block | `map(string)` | `{}` | no |

### config.yml distribution fields

| Field | Description | Default |
|-------|-------------|---------|
| `enabled` | Whether the distribution is enabled | `true` |
| `is_ipv6_enabled` | Enable IPv6 | `true` |
| `comment` | Distribution comment | `"${project}-${dist_key}-${environment}"` |
| `default_root_object` | Object returned for requests to `/` | `null` |
| `price_class` | `PriceClass_100`, `PriceClass_200`, or `PriceClass_All` | `"PriceClass_100"` |
| `aliases` | List of alternate domain names (CNAMEs) | `[]` |
| `acm_certificate_arn` | ACM certificate ARN (must be in `us-east-1`). Overridden by the module-level `acm_certificate_arn_overrides` input for the same `distribution_key` — never set this directly in `config.yml`; see `acm_certificate_arn_overrides` above. Omit (both here and in the override) to use the default `*.cloudfront.net` certificate | `null` |
| `minimum_protocol_version` | Minimum TLS version when `acm_certificate_arn` is set | `"TLSv1.2_2021"` |
| `web_acl_id` | WAF Web ACL ARN to associate | `null` |
| `http_version` | `http1.1`, `http2`, `http2and3`, or `http3` | `"http2"` |
| `wait_for_deployment` | Block until the distribution finishes deploying | `true` |
| `retain_on_delete` | Disable instead of destroying on `terraform destroy` | `false` |
| `origins` | Map of origin key to origin fields (see below) | required |
| `default_cache_behavior` | Default cache behavior fields (see below) | required |
| `ordered_cache_behaviors` | Map of path-based cache behaviors, evaluated in the order CloudFront receives them from the map (see below) | `{}` |
| `custom_error_responses` | List of `{ error_code, response_code, response_page_path, error_caching_min_ttl }` — use this for SPA fallback routing or a custom error page (see `config/config.yml` for examples of both) | `[]` |
| `geo_restriction` | `{ type, locations }` — `type` is `none`, `whitelist`, or `blacklist` | `{ type = "none" }` |
| `tags` | Per-distribution tags merged with the module-level `tags` variable | `{}` |

### origin fields

Every origin is a private S3 bucket read via Origin Access Control — there is no `type` field and no custom-origin shape.

| Field | Description | Default |
|-------|-------------|---------|
| `bucket_name` | Name of the S3 bucket (must already exist). The module resolves its regional domain name itself via the `aws_s3_bucket` data source — no `dependency` block or domain-name override needed | required |
| `bucket_region` | Region the bucket actually lives in, if different from `var.region` (which defaults to `us-east-1` for CloudFront/ACM). Used for both the `aws_s3_bucket` lookup and the `aws_s3_bucket_policy` this module attaches | `var.region` |
| `origin_path` | Path prefix appended to every request to this origin | `""` |
| `custom_headers` | Map of header name to value sent to the origin on every request | `{}` |
| `manage_bucket_policy` | Read the bucket's current policy and write it back with this origin's OAC grant folded in, scoped to this distribution's ARN. The bucket must already have some policy attached (see above). Set `false` only if the bucket's policy is managed elsewhere entirely | `true` |
| `extra_policy_statements` | List of additional IAM policy statement objects folded into the same document alongside the CloudFront grant and whatever else was already on the bucket. Each needs a unique `Sid` — re-applies use it to replace only the statements this module manages instead of duplicating them | `[]` |

### cache behavior fields (`default_cache_behavior` and each entry of `ordered_cache_behaviors`)

| Field | Description | Default |
|-------|-------------|---------|
| `path_pattern` | `ordered_cache_behaviors` entries only. Path pattern to match (e.g. `/api/*`) | required |
| `target_origin_id` | Key of the origin (from `origins`) to route to | required |
| `viewer_protocol_policy` | `allow-all`, `redirect-to-https`, or `https-only` | `"redirect-to-https"` |
| `allowed_methods` | HTTP methods CloudFront accepts from viewers | `["GET", "HEAD"]` |
| `cached_methods` | Subset of `allowed_methods` that gets cached | `["GET", "HEAD"]` |
| `compress` | Enable automatic compression | `true` |
| `cache_policy_id` | Managed or custom cache policy ID. When set, `forwarded_values`/TTL fields are omitted (mutually exclusive with them) | `null` |
| `origin_request_policy_id` | Managed or custom origin request policy ID | `null` |
| `response_headers_policy_id` | Managed or custom response headers policy ID | `null` |
| `forward_query_string` | Legacy mode only (`cache_policy_id` unset). Forward the query string to the origin | `false` |
| `forward_cookies` | Legacy mode only. `none`, `all`, or `whitelist` | `"none"` |
| `min_ttl` / `default_ttl` / `max_ttl` | Legacy mode only, in seconds | `0` / `3600` / `86400` |
| `function_associations` | List of `{ event_type, function_arn }` — attaches a CloudFront Function to this cache behavior. `event_type` is `viewer-request` or `viewer-response`. `function_arn` can be a static ARN here, or omitted and supplied via the module-level `function_arn_overrides` input keyed `"<dist_key>:default:<event_type>"` (default behavior) or `"<dist_key>:<ordered_cache_behaviors_key>:<event_type>"` — needed when the function comes from a `resources/cloudfront/function` `dependency` block, since `config_file` never sees Terragrunt interpolation. Since every cache behavior targets one origin via `target_origin_id`, add an `ordered_cache_behaviors` entry per path to attach a function to an origin other than the default one | `[]` |

## Outputs

| Name | Description |
|------|-------------|
| `distributions` | Map of distribution key to `{ id, arn, domain_name, hosted_zone_id, status }` |
| `origin_access_controls` | Map of `"<distribution_key>:<origin_key>"` to OAC ID |
