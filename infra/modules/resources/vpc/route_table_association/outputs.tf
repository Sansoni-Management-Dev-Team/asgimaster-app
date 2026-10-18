output "route_table_associations" {
  description = "Map of route table association key to attributes."
  value = {
    for key, assoc in aws_route_table_association.this : key => {
      id             = assoc.id
      subnet_id      = assoc.subnet_id
      route_table_id = assoc.route_table_id
    }
  }
}
