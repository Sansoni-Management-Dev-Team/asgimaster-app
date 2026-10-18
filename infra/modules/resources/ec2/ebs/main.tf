locals {
  attachments = {
    for key, vol in var.volumes : key => vol
    if vol.instance_id != null
  }
}

resource "aws_ebs_volume" "this" {
  for_each = var.volumes

  availability_zone    = each.value.availability_zone
  size                 = each.value.size
  type                 = each.value.type
  iops                 = each.value.iops
  throughput           = each.value.throughput
  encrypted            = each.value.encrypted
  kms_key_id           = each.value.kms_key_id
  snapshot_id          = each.value.snapshot_id
  multi_attach_enabled = each.value.multi_attach_enabled

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}

resource "aws_volume_attachment" "this" {
  for_each = local.attachments

  device_name = each.value.device_name
  volume_id   = aws_ebs_volume.this[each.key].id
  instance_id = each.value.instance_id
}
