resource "aws_lb" "this" {
  for_each = var.load_balancers

  name               = "${var.project}-${each.key}-${var.environment}"
  internal           = each.value.internal
  load_balancer_type = "application"
  security_groups    = each.value.security_group_ids
  subnets            = each.value.subnet_ids

  enable_deletion_protection = each.value.enable_deletion_protection

  tags = merge(var.tags, each.value.tags, {
    Name = "${var.project}-${each.key}-${var.environment}"
  })
}
