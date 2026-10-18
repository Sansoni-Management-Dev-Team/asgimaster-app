output "clusters" {
  description = "Map of cluster key to replication group attributes."
  value = {
    for key, rg in aws_elasticache_replication_group.this : key => {
      id                       = rg.id
      arn                      = rg.arn
      primary_endpoint_address = rg.primary_endpoint_address
      reader_endpoint_address  = rg.reader_endpoint_address
      port                     = rg.port
    }
  }
}
