locals {
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  tags_vars   = read_terragrunt_config(find_in_parent_folders("tags.hcl"))
  tags        = local.tags_vars.locals[local.environment]
  regions     = local.region_vars.locals[local.environment]
  environment = get_env("TG_VAR_ENVIRONMENT")
}

remote_state {
  backend = "s3"
  config = {
    encrypt        = true
    bucket         = "tg-state-${local.environment}-${local.tags.project}-${local.regions.aws_region}"
    key            = "${path_relative_to_include()}/tf.tfstate"
    region         = local.regions.aws_region
    use_lockfile   = true
    # Kept while devops-infrastructure-asgi-app can still apply to this state.
    # Remove once only this repo applies.
    dynamodb_table = "tg-locks-${local.environment}-${local.tags.project}-${local.regions.aws_region}"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

inputs = merge(
  local.regions,
  local.tags,
  { region = local.regions.aws_region },
)