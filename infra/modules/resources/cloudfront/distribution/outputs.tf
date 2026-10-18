output "distributions" {
  description = "Map of distribution key to distribution attributes."
  value = {
    for key, d in aws_cloudfront_distribution.this : key => {
      id             = d.id
      arn            = d.arn
      domain_name    = d.domain_name
      hosted_zone_id = d.hosted_zone_id
      status         = d.status
    }
  }
}

output "origin_access_controls" {
  description = "Map of \"<distribution_key>:<origin_key>\" to origin access control ID, for s3-type origins."
  value = {
    for key, oac in aws_cloudfront_origin_access_control.this : key => oac.id
  }
}
