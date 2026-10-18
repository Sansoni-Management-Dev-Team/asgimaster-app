# resources/cloudfront/function

Creates one or more CloudFront Functions. Each function's code is loaded from a local `.js` file referenced by `file_path`. Use the `arn` output in a `function_association` block on a CloudFront distribution's cache behavior.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/cloudfront/function?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  functions = {
    viewer-request-redirect = {
      name      = "viewer-request-redirect"
      file_path = "${get_terragrunt_dir()}/functions/viewer-request-redirect.js"
      comment   = "Redirects viewer requests to the canonical host"
      publish   = true
      tags      = { Environment = "prod" }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `functions` | Map of CloudFront Functions to create | `map(object)` | — | yes |
| `functions[*].name` | Name of the CloudFront Function | `string` | — | yes |
| `functions[*].file_path` | Path to the `.js` file containing the function code | `string` | — | yes |
| `functions[*].runtime` | Function runtime (`cloudfront-js-1.0` or `cloudfront-js-2.0`) | `string` | `"cloudfront-js-2.0"` | no |
| `functions[*].comment` | Comment describing the function | `string` | `null` | no |
| `functions[*].publish` | Whether to publish the function to the `LIVE` stage on creation/update | `bool` | `true` | no |
| `functions[*].key_value_store_associations` | ARNs of CloudFront Key Value Stores to associate (AWS limits this to one) | `list(string)` | `[]` | no |
| `functions[*].tags` | Tags to apply to the function | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `functions` | Map of function key to `{ arn, name, status, etag, live_stage_etag }` |
