output "functions" {
  description = "Map of function key to CloudFront Function attributes."
  value = {
    for key, fn in aws_cloudfront_function.this : key => {
      arn             = fn.arn
      name            = fn.name
      status          = fn.status
      etag            = fn.etag
      live_stage_etag = fn.live_stage_etag
    }
  }
}
