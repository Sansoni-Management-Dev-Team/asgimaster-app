terraform {
  source = "${get_parent_terragrunt_dir("root")}/modules//resources/vpc/network_acl_rule"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}

dependency "nacl" {
  config_path = find_in_parent_folders("modules/vpc/nacl")

  mock_outputs_allowed_terraform_commands = ["validate", "init", "plan"]
  mock_outputs = {
    network_acls = {
      private = {
        id     = "acl-123456789"
        vpc_id = "vpc-123456789"
      }
      public = {
        id     = "acl-123456789"
        vpc_id = "vpc-123456789"
      }
    }
  }
}

inputs = {
  network_acl_ids = {
    public  = dependency.nacl.outputs.network_acls["public"].id
    private = dependency.nacl.outputs.network_acls["private"].id
  }
  config_file = "${get_terragrunt_dir()}/config/config.yml"
}