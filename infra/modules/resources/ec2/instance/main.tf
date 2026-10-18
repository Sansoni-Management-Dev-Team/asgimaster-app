locals {
  # Every dev's public key under keys/ is granted SSH access to every
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

  instances_with_role = {
    for key, inst in var.instances : key => inst
    if inst.iam_role_arn != null
  }
}

resource "aws_iam_instance_profile" "this" {
  for_each = local.instances_with_role

  name = "${var.project}-${each.key}-${var.environment}"
  role = regex(".*/([^/]+)$", each.value.iam_role_arn)[0]

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_instance" "this" {
  for_each = var.instances

  ami                         = each.value.ami
  instance_type               = each.value.instance_type
  subnet_id                   = each.value.subnet_id
  vpc_security_group_ids      = each.value.vpc_security_group_ids
  associate_public_ip_address = each.value.associate_public_ip
  iam_instance_profile        = try(aws_iam_instance_profile.this[each.key].name, null)
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
