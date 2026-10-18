# resources/s3

Creates one or more S3 buckets from a YAML config file. Covers three common use cases with the same set of fields:

- **Standalone static website hosting** — set `website`, `block_public_access: false`, and a `policy` granting public read (see `config/website_public_read.json`). Served directly from the bucket's website endpoint.
- **CDN origin** (for `resources/cloudfront/s3` or an `s3`-type origin in `resources/cloudfront/distribution`) — leave `block_public_access` at its default (`true`) and leave `policy` unset. Both of those modules attach the OAC-grant bucket policy themselves, in the same apply as the distribution, so this module needs no `dependency` block or template wiring for it — see either module's README.
- **Plain storage/data bucket** — leave `website` unset, stay private, and attach a baseline policy (e.g. deny non-TLS requests — see `config/enforce_ssl.json`) plus lifecycle rules to transition objects to cheaper storage classes and expire them over time.

Every bucket gets default (AES256) or KMS server-side encryption, a public access block resource (defaulting to fully blocked), and optional versioning, CORS, and lifecycle rules. Bucket policies are rendered with `templatefile()`, so they may reference `${bucket_name}`, `${bucket_arn}`, `${region}`, `${aws_account}`, `${project}`, `${environment}`, plus anything supplied per-bucket via `config.yml`'s `template_vars`, plus the module-level `extra_template_vars` input for values only known at the Terragrunt layer (e.g. a `dependency` block output from another module).

`config_file` itself is also rendered with `templatefile()` before being parsed as YAML, so it may reference `${domain}` (the module's `domain` input) anywhere in the file — e.g. to build a CORS `allowed_origins` entry for the website bucket without hardcoding the domain. `domain` is optional and defaults to `""`; omit it for configs that don't need CORS or otherwise reference `${domain}`.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/s3?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"
  config_file = "${get_terragrunt_dir()}/config/config.yml"
  domain      = "example.com"

  tags = {
    ManagedBy = "terraform"
  }
}
```

### config/config.yml

```yaml
buckets:
  # Standalone static website hosting - publicly readable, served directly
  # from the S3 website endpoint (no CDN in front).
  website:
    versioning: true
    block_public_access: false
    website:
      index_document: index.html
      error_document: error.html
    cors_rules:
      - allowed_methods: ["GET"]
        allowed_origins: ["https://app.${domain}"]
        allowed_headers: ["*"]
        max_age_seconds: 3000
    policy: website_public_read.json
    tags:
      Component: website

  # Private bucket used as a CloudFront origin. No policy set here -
  # resources/cloudfront/s3 (or an s3-type origin in
  # resources/cloudfront/distribution) attaches the OAC-grant policy
  # itself, scoped to its distribution's ARN, in the same apply as the
  # distribution.
  cdn_origin:
    versioning: true
    block_public_access: true
    lifecycle_rules:
      - id: expire-noncurrent-versions
        prefix: ""
        noncurrent_version_expiration_days: 30
    tags:
      Component: cdn-origin

  # Plain storage/data bucket - no website, no CDN. Private, TLS-only
  # access, and a lifecycle rule that moves objects to cheaper storage
  # classes over time before expiring them.
  data:
    versioning: true
    lifecycle_rules:
      - id: transition-and-expire
        prefix: ""
        transitions:
          - days: 30
            storage_class: STANDARD_IA
          - days: 90
            storage_class: GLACIER
        expiration_days: 365
        noncurrent_version_expiration_days: 30
    policy: enforce_ssl.json
    tags:
      Component: data
```

### config/website_public_read.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "${bucket_arn}/*"
    }
  ]
}
```

### config/enforce_ssl.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "${bucket_arn}",
        "${bucket_arn}/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for bucket names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `config_file` | Absolute path to the YAML config file | `string` | — | yes |
| `domain` | Base domain substituted into `${domain}` placeholders in `config_file` (e.g. CORS `allowed_origins`) | `string` | `""` | no |
| `tags` | Tags applied to all buckets | `map(string)` | `{}` | no |
| `extra_template_vars` | Additional key/value pairs merged into every bucket policy's `templatefile()` render, on top of each bucket's own `template_vars`. For values only known at the Terragrunt layer (e.g. a CloudFront distribution ARN from a `dependency` block) | `map(string)` | `{}` | no |

### config.yml bucket fields

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Explicit bucket name (must be globally unique). If empty or omitted, falls back to `"${project}-${bucket_key}-${environment}"` | none |
| `versioning` | Enable object versioning | `false` |
| `force_destroy` | Allow bucket deletion even when it contains objects | `false` |
| `kms_key_id` | KMS key ARN for SSE-KMS encryption. Leave unset for SSE-S3 (AES256) | none |
| `block_public_access` | Block all public ACLs/policies on the bucket. Set to `false` only for a public static website | `true` |
| `website` | `{ index_document, error_document, redirect_all_requests_to }` — enables static website hosting | none |
| `cors_rules` | List of `{ allowed_methods, allowed_origins, allowed_headers, expose_headers, max_age_seconds }` | `[]` |
| `lifecycle_rules` | List of `{ id, prefix, enabled, transitions, expiration_days, noncurrent_version_expiration_days }` | `[]` |
| `policy` | Filename of a bucket policy JSON (resolved relative to the config file), rendered with `templatefile()` | none |
| `template_vars` | Additional key/value pairs available inside `policy`'s `templatefile()` render, on top of `bucket_name`, `bucket_arn`, `region`, `aws_account`, `project`, `environment`. Overridden by the module-level `extra_template_vars` input for the same key | `{}` |
| `tags` | Per-bucket tags merged with the module-level `tags` variable | `{}` |

### website fields

| Field | Description |
|-------|-------------|
| `index_document` | Suffix appended to requests for a directory (e.g. `index.html`). Ignored if `redirect_all_requests_to` is set |
| `error_document` | Object key returned for 4xx errors. Ignored if `redirect_all_requests_to` is set |
| `redirect_all_requests_to` | Hostname to redirect all requests to; when set, `index_document`/`error_document` are ignored |

### lifecycle_rules entry fields

| Field | Description | Default |
|-------|-------------|---------|
| `id` | Unique rule identifier | required |
| `prefix` | Object key prefix the rule applies to (empty string matches the whole bucket) | `""` |
| `enabled` | Whether the rule is active | `true` |
| `transitions` | List of `{ days, storage_class }` — moves objects to a cheaper storage class (e.g. `STANDARD_IA`, `GLACIER`, `DEEP_ARCHIVE`) after `days` | `[]` |
| `expiration_days` | Delete current object versions after this many days | none |
| `noncurrent_version_expiration_days` | Delete noncurrent (versioned) object versions after this many days | none |

## Outputs

| Name | Description |
|------|-------------|
| `buckets` | Map of bucket key to `{ id, arn, bucket_domain_name, bucket_regional_domain_name, region, website_endpoint, website_domain }` |
