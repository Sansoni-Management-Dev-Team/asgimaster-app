output "brokers" {
  description = "Map of broker key to broker attributes."
  value = {
    for key, broker in aws_mq_broker.this : key => {
      id           = broker.id
      arn          = broker.arn
      endpoints    = broker.instances[*].endpoints
      username_key = local.brokers[key].username_key
    }
  }
}
