locals {
  config       = yamldecode(file(var.config_file))
  config_dir   = dirname(var.config_file)
  repositories = local.config.repositories
}

resource "aws_ecr_repository" "this" {
  for_each = local.repositories

  name                 = "${var.project}-${each.key}-${var.environment}"
  image_tag_mutability = try(each.value.image_tag_mutability, "MUTABLE")
  force_delete         = try(each.value.force_delete, false)

  image_scanning_configuration {
    scan_on_push = try(each.value.scan_on_push, true)
  }

  tags = merge(var.tags,
    { Name = "${var.project}-${each.key}-${var.environment}" }
  )
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = { for k, v in local.repositories : k => v if try(v.policy, null) != null }

  repository = aws_ecr_repository.this[each.key].name
  policy     = file("${local.config_dir}/${each.value.policy}")
}
