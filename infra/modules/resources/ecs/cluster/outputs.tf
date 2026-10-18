output "clusters" {
  description = "Map of cluster key to cluster attributes."
  value = {
    for key, cluster in aws_ecs_cluster.this : key => {
      arn  = cluster.arn
      name = cluster.name
      id   = cluster.id
    }
  }
}
