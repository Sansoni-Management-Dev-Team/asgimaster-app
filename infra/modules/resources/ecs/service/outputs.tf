output "services" {
  description = "Map of service key to ECS service attributes."
  value = {
    for key, svc in aws_ecs_service.this : key => {
      id   = svc.id
      name = svc.name
    }
  }
}
