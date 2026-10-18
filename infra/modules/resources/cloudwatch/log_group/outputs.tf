output "log_groups" {
  description = "Map of log group key to CloudWatch log group attributes."
  value = {
    for key, lg in aws_cloudwatch_log_group.this : key => {
      arn  = lg.arn
      name = lg.name
    }
  }
}
