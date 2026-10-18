output "vpcs" {
  description = "Map of VPC key to VPC attributes."
  value = {
    for key, vpc in aws_vpc.this : key => {
      id         = vpc.id
      cidr_block = vpc.cidr_block
    }
  }
}
