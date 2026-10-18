output "eips" {
  description = "Map of EIP key to EIP attributes."
  value = {
    for key, eip in aws_eip.this : key => {
      id            = eip.id
      public_ip     = eip.public_ip
      allocation_id = eip.allocation_id
    }
  }
}
