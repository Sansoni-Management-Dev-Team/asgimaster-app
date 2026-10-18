output "task_definitions" {
  description = "Map of task definition key to task definition attributes."
  value = {
    for key, td in aws_ecs_task_definition.this : key => {
      arn      = td.arn
      family   = td.family
      revision = td.revision
    }
  }
}
