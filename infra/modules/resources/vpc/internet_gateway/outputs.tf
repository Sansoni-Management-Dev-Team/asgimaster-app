output "internet_gateways" {
  description = "Map of Internet Gateway key to attributes."
  value = {
    for key, igw in aws_internet_gateway.this : key => {
      id     = igw.id
      vpc_id = igw.vpc_id
    }
  }
}
