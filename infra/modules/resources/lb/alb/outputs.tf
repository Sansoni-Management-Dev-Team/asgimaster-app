output "load_balancers" {
  description = "Map of ALB key to load balancer attributes."
  value = {
    for key, alb in aws_lb.this : key => {
      arn      = alb.arn
      dns_name = alb.dns_name
      zone_id  = alb.zone_id
      name     = alb.name
    }
  }
}
