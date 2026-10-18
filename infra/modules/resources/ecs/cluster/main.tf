resource "aws_ecs_cluster" "this" {
  for_each = var.clusters

  name = "${var.project}-${each.key}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = each.value.container_insights
  }

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
