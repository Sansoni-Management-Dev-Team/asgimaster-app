output "route_tables" {
  description = "Map of route table key to attributes."
  value = {
    for key, rt in aws_route_table.this : key => {
      id     = rt.id
      vpc_id = rt.vpc_id
    }
  }
}
