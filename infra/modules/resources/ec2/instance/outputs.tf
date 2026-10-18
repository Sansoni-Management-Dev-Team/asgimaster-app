output "instances" {
  description = "Map of instance key to instance attributes."
  value = {
    for key, inst in aws_instance.this : key => {
      id         = inst.id
      arn        = inst.arn
      public_ip  = inst.public_ip
      private_ip = inst.private_ip
    }
  }
}
