output "public_subnets" {
  description = "Map of AZ name to public subnet attributes."
  value = {
    for az, subnet in aws_subnet.public : az => {
      id                = subnet.id
      cidr_block        = subnet.cidr_block
      availability_zone = subnet.availability_zone
      vpc_id            = subnet.vpc_id
    }
  }
}

output "private_subnets" {
  description = "Map of AZ name to private subnet attributes."
  value = {
    for az, subnet in aws_subnet.private : az => {
      id                = subnet.id
      cidr_block        = subnet.cidr_block
      availability_zone = subnet.availability_zone
      vpc_id            = subnet.vpc_id
    }
  }
}

output "database_subnets" {
  description = "Map of AZ name to database subnet attributes."
  value = {
    for az, subnet in aws_subnet.database : az => {
      id                = subnet.id
      cidr_block        = subnet.cidr_block
      availability_zone = subnet.availability_zone
      vpc_id            = subnet.vpc_id
    }
  }
}
