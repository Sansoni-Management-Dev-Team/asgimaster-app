data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-resolute-26.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  # Every dev's public key under keys/ is granted SSH access to every bastion
  # instance this module manages. No aws_key_pair / private key material is
  # ever created or handled by Terraform.
  authorized_keys = [
    for f in fileset("${path.module}/keys", "*.pub") :
    trimspace(file("${path.module}/keys/${f}"))
  ]

  user_data = <<-EOT
    #cloud-config
    ssh_authorized_keys:
    %{~for key in local.authorized_keys~}
      - ${key}
    %{~endfor~}
  EOT
}

resource "aws_instance" "this" {
  for_each = var.instances

  ami                         = coalesce(each.value.ami, data.aws_ami.ubuntu.id)
  instance_type               = each.value.instance_type
  subnet_id                   = each.value.subnet_id
  vpc_security_group_ids      = each.value.vpc_security_group_ids
  associate_public_ip_address = each.value.associate_public_ip
  user_data                   = local.user_data

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_size = each.value.root_volume_size
    encrypted   = true
    kms_key_id  = each.value.root_volume_kms_key_id
  }

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
