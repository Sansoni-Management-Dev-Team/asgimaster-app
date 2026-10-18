output "hosted_zones" {
  description = "Map of hosted zone key to hosted zone attributes."
  value = {
    for key, zone in aws_route53_zone.this : key => {
      id          = zone.zone_id
      arn         = zone.arn
      name        = zone.name
      name_servers = zone.name_servers
    }
  }
}
