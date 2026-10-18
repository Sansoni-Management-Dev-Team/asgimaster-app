# resources/acm

Creates one or more ACM (AWS Certificate Manager) certificates. Supports DNS and EMAIL validation methods. Use `domain_validation_options` from the output to create the required DNS records for DNS-validated certificates.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/acm?ref=v1.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "hosted_zone" {
  config_path = "../route53/hosted_zone"
}

inputs = {
  certificates = {
    api-prod = {
      domain_name               = "api.yourdomain.com"
      subject_alternative_names = ["*.api.yourdomain.com"]
      validation_method         = "DNS"
      tags                      = { Environment = "prod" }
    }
    web-prod = {
      domain_name       = "yourdomain.com"
      validation_method = "DNS"
      tags              = { Environment = "prod" }
    }
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `certificates` | Map of ACM certificates to create | `map(object)` | — | yes |
| `certificates[*].domain_name` | Primary domain name for the certificate | `string` | — | yes |
| `certificates[*].subject_alternative_names` | Additional domain names to include | `list(string)` | `[]` | no |
| `certificates[*].validation_method` | Validation method (`DNS` or `EMAIL`) | `string` | `"DNS"` | no |
| `certificates[*].key_algorithm` | Key algorithm (`RSA_2048`, `EC_prime256v1`, etc.) | `string` | `null` | no |
| `certificates[*].tags` | Tags to apply to the certificate | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `certificates` | Map of certificate key to `{ arn, domain_name, subject_alternative_names, domain_validation_options, status }` |
