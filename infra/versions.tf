terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Partial config. Supply bucket, key and region with: terraform init -backend-config=backend.hcl
  backend "s3" {
    use_lockfile = true
  }
}
