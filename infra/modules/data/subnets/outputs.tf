output "subnet_ids" {
  description = "List of subnet IDs matching the tag filter."
  value       = data.aws_subnets.this.ids
}

output "vpc_ids" {
  description = "Distinct VPC IDs of the matching subnets."
  value       = distinct([for subnet in data.aws_subnet.this : subnet.vpc_id])
}

output "subnets" {
  description = "Map of subnet ID to subnet attributes."
  value = {
    for id, subnet in data.aws_subnet.this : id => {
      vpc_id            = subnet.vpc_id
      availability_zone = subnet.availability_zone
      cidr_block        = subnet.cidr_block
    }
  }
}
