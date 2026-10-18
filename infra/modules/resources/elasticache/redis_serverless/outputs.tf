output "caches" {
  description = "Map of cache key to serverless cache attributes."
  value = {
    for key, cache in aws_elasticache_serverless_cache.this : key => {
      id       = cache.id
      arn      = cache.arn
      endpoint = cache.endpoint
      status   = cache.status
    }
  }
}
