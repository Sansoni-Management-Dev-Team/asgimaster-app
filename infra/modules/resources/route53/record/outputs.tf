output "records" {
  description = "Map of record key to record attributes."
  value = {
    for key, record in aws_route53_record.this : key => {
      fqdn = record.fqdn
      name = record.name
      type = record.type
    }
  }
}
