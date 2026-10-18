output "nat_gateways" {
  description = "Map of NAT Gateway key to attributes."
  value = {
    for key, nat in aws_nat_gateway.this : key => {
      id        = nat.id
      subnet_id = nat.subnet_id
      public_ip = nat.public_ip
    }
  }
}
