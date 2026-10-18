terraform {
  source = "git::https://github.com/Sansoni-Management-Dev-Team/devops-terraform-modules.git//resources/vpc/network_acl_rule?ref=0.0.6"
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