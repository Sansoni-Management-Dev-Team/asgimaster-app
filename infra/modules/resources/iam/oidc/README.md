# resources/iam/oidc

Creates one or more IAM OIDC identity providers (`aws_iam_openid_connect_provider`), e.g. for federating GitHub Actions with AWS via `sts:AssumeRoleWithWebIdentity`. This module only creates the identity provider itself — pair it with `resources/iam/role` to create the role and trust policy that federated identities assume. `thumbprint_list` can be left empty for providers AWS validates against its own trusted CAs (GitHub, GitLab, Auth0, Google); AWS will fetch it automatically. Wire the provider's ARN into a role's trust policy through a Terragrunt `dependency` block — this module never references `resources/iam/role` directly.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/iam/oidc?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  oidc_providers = {
    github_actions = {
      url            = "https://token.actions.githubusercontent.com"
      client_id_list = ["sts.amazonaws.com"]
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### Using it with `resources/iam/role` for GitHub Actions CI/CD

The account ID is already available to `resources/iam/role` via the `${aws_account}` template placeholder, so the OIDC provider's ARN can be referenced without any cross-module dependency — it's deterministic per account:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${aws_account}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<org>/<repo>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

The role that assumes this trust policy must be created *after* the OIDC provider exists in the account — apply this module first.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `oidc_providers` | Map of OIDC providers to create | `map(object({...}))` | — | yes |
| `tags` | Tags applied to all OIDC providers | `map(string)` | `{}` | no |

### oidc_providers object fields

| Field | Description | Default | Required |
|-------|-------------|---------|----------|
| `url` | Issuer URL of the OIDC identity provider (e.g. `https://token.actions.githubusercontent.com`) | — | yes |
| `client_id_list` | List of client IDs (audiences) registered with the provider | `["sts.amazonaws.com"]` | no |
| `thumbprint_list` | List of server certificate thumbprints. Leave empty for providers AWS validates against its own trusted CAs (GitHub, GitLab, Auth0, Google) — AWS fetches it automatically | `[]` | no |
| `tags` | Per-provider tags merged with the module-level `tags` variable | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `oidc_providers` | Map of OIDC provider key to `{ arn, url }` |
