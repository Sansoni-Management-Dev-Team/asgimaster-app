output "volumes" {
  description = "Map of volume key to EBS volume attributes."
  value = {
    for key, vol in aws_ebs_volume.this : key => {
      id                = vol.id
      arn               = vol.arn
      availability_zone = vol.availability_zone
      size              = vol.size
      type              = vol.type
      device_name       = try(aws_volume_attachment.this[key].device_name, null)
    }
  }
}
