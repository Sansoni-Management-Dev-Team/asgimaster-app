# resources/ec2/instance

Creates one or more general-purpose EC2 instances. There is no `aws_key_pair` resource — instead, every dev's SSH public key under [`keys/`](./keys) is baked into each instance's `authorized_keys` via `user_data` on launch, so each dev connects with their own key rather than a shared PEM file. Security groups are not managed by this module; pass in existing SG ID(s) (e.g. from `resources/ec2/sg`). The AMI is a required input — bring your own AMI ID. Passing `iam_role_arn` creates an `aws_iam_instance_profile` from that role (created elsewhere, e.g. `resources/iam/role`) and attaches it to the instance.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ec2/instance?ref=v0.0.1"
}

include "root" {
  path = find_in_parent_folders()
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "sg" {
  config_path = "../ec2/sg"
}

dependency "role" {
  config_path = "../iam/role"
}

inputs = {
  project     = "myapp"
  environment = "production"

  instances = {
    main = {
      ami                    = "ami-0123456789abcdef0"
      subnet_id              = dependency.vpc.outputs.public_subnet_ids[0]
      vpc_security_group_ids = [dependency.sg.outputs.security_groups["app"].id]
      iam_role_arn           = dependency.role.outputs.roles["app"].arn
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

### keys/

Add each dev's SSH public key as a `.pub` file under `keys/` (e.g. `keys/alice.pub`). Every file found there is granted access on every instance in `var.instances`. See [`keys/README.md`](./keys/README.md) for details, including how key revocation works.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `tags` | Tags applied to all instances | `map(string)` | `{}` | no |
| `instances` | Map of EC2 instances to create. The key is used as the name suffix and resource identifier | `map(object({...}))` | — | yes |

### `instances` object fields

| Field | Description | Type | Default | Required |
|-------|-------------|------|---------|----------|
| `ami` | AMI ID to launch the instance from | `string` | — | yes |
| `subnet_id` | Subnet to launch the instance in | `string` | — | yes |
| `vpc_security_group_ids` | Security group IDs to attach | `list(string)` | — | yes |
| `instance_type` | EC2 instance type | `string` | `"t3.micro"` | no |
| `associate_public_ip` | Assign a public IP | `bool` | `true` | no |
| `root_volume_size` | Root EBS volume size (GiB) | `number` | `8` | no |
| `root_volume_kms_key_id` | KMS key for root volume encryption (root volume is always encrypted) | `string` | AWS-managed default key | no |
| `iam_role_arn` | ARN of an existing IAM role to attach (an instance profile is created from it) | `string` | `null` | no |
| `tags` | Extra tags merged onto this instance | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `instances` | Map of instance key to `{ id, arn, public_ip, private_ip }` |
