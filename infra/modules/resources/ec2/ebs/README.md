# resources/ec2/ebs

Creates one or more EBS volumes. A volume can be left standalone (e.g. for an ECS task running on EC2 to mount as a host volume, or for later attachment outside Terraform) or attached directly to an EC2 instance by setting `instance_id` and `device_name` together.

## Sample Terragrunt Usage

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/ec2/ebs?ref=v0.0.9"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  project     = "myapp"
  environment = "production"

  volumes = {
    ecs-scratch = {
      availability_zone = "ap-southeast-1a"
      size               = 100
      type               = "gp3"
    }
  }

  tags = {
    ManagedBy = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region to use for the provider | `string` | `"ap-southeast-1"` | no |
| `project` | Project name, used as a prefix for resource names | `string` | — | yes |
| `environment` | Deployment environment | `string` | `"develop"` | no |
| `volumes` | Map of EBS volumes to create. The key is used as a unique identifier | `map(object({...}))` | `{}` | no |
| `tags` | Tags applied to all volumes | `map(string)` | `{}` | no |

### `volumes` object fields

| Field | Description | Default |
|-------|-------------|---------|
| `availability_zone` | AZ the volume is created in; must match the target instance's AZ if attaching | required |
| `size` | Volume size in GiB | `8` |
| `type` | Volume type (`gp3`, `gp2`, `io1`, `io2`, `st1`, `sc1`) | `"gp3"` |
| `iops` | Provisioned IOPS, only used by `io1`/`io2`/`gp3` | `null` |
| `throughput` | Throughput in MiB/s, only used by `gp3` | `null` |
| `encrypted` | Enable EBS encryption | `true` |
| `kms_key_id` | CMK ARN to use for encryption. Leave unset to use the AWS-managed EBS key | `null` |
| `snapshot_id` | Snapshot ID to restore the volume from | `null` |
| `multi_attach_enabled` | Allow the volume to be attached to multiple instances (`io1`/`io2` only) | `false` |
| `instance_id` | Instance to attach this volume to. Must be set together with `device_name` | `null` |
| `device_name` | Device name to expose the volume as on the instance (e.g. `/dev/xvdf`). Must be set together with `instance_id` | `null` |
| `tags` | Additional tags for this specific volume, merged with `var.tags` | `{}` |

## Outputs

| Name | Description |
|------|-------------|
| `volumes` | Map of volume key to `{ id, arn, availability_zone, size, type, device_name }`. `device_name` is `null` for standalone (unattached) volumes |
