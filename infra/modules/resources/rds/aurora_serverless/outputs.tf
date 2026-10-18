output "clusters" {
  description = "Map of cluster key to cluster attributes."
  value = {
    for key, cluster in aws_rds_cluster.this : key => {
      arn             = cluster.arn
      endpoint        = cluster.endpoint
      reader_endpoint = cluster.reader_endpoint
      port            = cluster.port
      database_name   = cluster.database_name
      kms_key_id      = cluster.kms_key_id
      username_key    = local.clusters[key].username_key
    }
  }
}
