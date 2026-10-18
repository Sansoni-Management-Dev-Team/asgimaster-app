output "buckets" {
  description = "Map of bucket key to bucket attributes."
  value = {
    for key, b in aws_s3_bucket.this : key => {
      id                          = b.id
      arn                         = b.arn
      bucket_domain_name          = b.bucket_domain_name
      bucket_regional_domain_name = b.bucket_regional_domain_name
      region                      = b.region
      website_endpoint            = try(aws_s3_bucket_website_configuration.this[key].website_endpoint, null)
      website_domain              = try(aws_s3_bucket_website_configuration.this[key].website_domain, null)
    }
  }
}
