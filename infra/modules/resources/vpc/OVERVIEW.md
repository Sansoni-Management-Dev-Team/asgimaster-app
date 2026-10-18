# resources/vpc

Overview of the VPC network modules and their relationships.

## MVP Resource List

| # | Module | Resource | Purpose |
|---|--------|----------|---------|
| 1 | `vpc` | `aws_vpc` | The network boundary. Defines the CIDR block for the whole network. |
| 2 | `subnet` | `aws_subnet` | Carves the VPC CIDR into public and private slices, one per AZ. |
| 3 | `internet_gateway` | `aws_internet_gateway` | Attached to the VPC, gives public subnets a path to/from the internet. |
| 4 | `eip` | `aws_eip` | Static public IP reserved for the NAT Gateway (one per AZ). |
| 5 | `nat_gateway` | `aws_nat_gateway` | Lives in a public subnet, lets private subnets initiate outbound traffic without being publicly reachable. |
| 6 | `route_table` | `aws_route_table` | Separate tables for public (route to IGW) and private (route to NAT). |
| 7 | `route_table_association` | `aws_route_table_association` | Wires each subnet to its correct route table. Without this, subnets fall back to the default VPC route table. |
| 8 | `network_acl` | `aws_network_acl` | Stateless subnet-level firewall. Explicit is better than relying on the AWS default. |
| 9 | `network_acl_association` | `aws_network_acl_association` | Attaches the NACL to each subnet. |
| 10 | `network_acl_rule` | `aws_network_acl_rule` | The actual allow/deny rules on the NACL — ingress and egress. Without rules, everything is denied. |

## Multi-AZ Breakdown

| Resource | Multi-AZ? | Why |
|----------|-----------|-----|
| `aws_vpc` | No | One per region, spans all AZs automatically. |
| `aws_subnet` | Yes | Each subnet lives in exactly one AZ — create one public + one private per AZ. |
| `aws_internet_gateway` | No | One per VPC, not AZ-bound. |
| `aws_eip` | Yes | One per NAT Gateway, so one per AZ. |
| `aws_nat_gateway` | Yes | For high availability, one per AZ (sits in the public subnet of each AZ). |
| `aws_route_table` | Partially | Public: one shared table. Private: one per AZ (each points to its own NAT Gateway). |
| `aws_route_table_association` | Yes | One per subnet, so one per AZ. |
| `aws_network_acl` | No | One NACL can cover all subnets. |
| `aws_network_acl_association` | Yes | One per subnet, so one per AZ. |
| `aws_network_acl_rule` | No | Rules live on the NACL, not per AZ. |

> **Note:** The number of AZs is controlled entirely by the caller — pass 2 entries in the subnet/eip/nat_gateway maps for 2 AZs, 3 for 3. No module changes required.

## Sample Terragrunt Usage — MVP (Non-Live, 2 AZ, 1 NAT GW)

---

### `vpc/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/vpc?ref=v0.0.x"
}

inputs = {
  vpcs = {
    main = {
      cidr_block = "10.0.0.0/16"
      tags       = { Name = "main", Environment = "dev" }
    }
  }
}
```

---

### `subnet/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/subnet?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id        = dependency.vpc.outputs.vpcs["main"].id
  public_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
  tags          = { Environment = "dev" }
}
```

---

### `internet_gateway/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/internet_gateway?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  internet_gateways = {
    main = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      tags   = { Name = "main", Environment = "dev" }
    }
  }
}
```

---

### `eip/terragrunt.hcl`
> 1 EIP only — shared NAT GW for non-live

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/eip?ref=v0.0.x"
}

inputs = {
  eips = {
    nat = {
      tags = { Name = "nat", Environment = "dev" }
    }
  }
}
```

---

### `nat_gateway/terragrunt.hcl`
> 1 NAT GW in az-a — both AZs share it

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/nat_gateway?ref=v0.0.x"
}

dependency "eip" {
  config_path = "../eip"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "internet_gateway" {
  config_path = "../internet_gateway"
}

inputs = {
  nat_gateways = {
    main = {
      allocation_id = dependency.eip.outputs.eips["nat"].allocation_id
      subnet_id     = dependency.subnet.outputs.public_subnets["ap-southeast-1a"].id
      tags          = { Name = "main", Environment = "dev" }
    }
  }
}
```

---

### `route_table/terragrunt.hcl`
> 1 public table, 1 shared private table (both private subnets use it)

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/route_table?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "internet_gateway" {
  config_path = "../internet_gateway"
}

dependency "nat_gateway" {
  config_path = "../nat_gateway"
}

inputs = {
  route_tables = {
    public = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block = "0.0.0.0/0"
          gateway_id = dependency.internet_gateway.outputs.internet_gateways["main"].id
        }
      }
      tags = { Name = "public", Environment = "dev" }
    }
    private = {
      vpc_id = dependency.vpc.outputs.vpcs["main"].id
      routes = {
        default = {
          cidr_block     = "0.0.0.0/0"
          nat_gateway_id = dependency.nat_gateway.outputs.nat_gateways["main"].id
        }
      }
      tags = { Name = "private", Environment = "dev" }
    }
  }
}
```

---

### `route_table_association/terragrunt.hcl`
> Both private subnets point to the same private route table

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/route_table_association?ref=v0.0.x"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "route_table" {
  config_path = "../route_table"
}

inputs = {
  public_subnets         = dependency.subnet.outputs.public_subnets
  private_subnets        = dependency.subnet.outputs.private_subnets
  public_route_table_id  = dependency.route_table.outputs.route_tables["public"].id
  private_route_table_id = dependency.route_table.outputs.route_tables["private"].id
}
```

---

### `network_acl/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl?ref=v0.0.x"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  network_acls = {
    public  = { vpc_id = dependency.vpc.outputs.vpcs["main"].id, tags = { Name = "public",  Environment = "dev" } }
    private = { vpc_id = dependency.vpc.outputs.vpcs["main"].id, tags = { Name = "private", Environment = "dev" } }
  }
}
```

---

### `network_acl_association/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl_association?ref=v0.0.x"
}

dependency "subnet" {
  config_path = "../subnet"
}

dependency "network_acl" {
  config_path = "../network_acl"
}

inputs = {
  public_subnets         = dependency.subnet.outputs.public_subnets
  private_subnets        = dependency.subnet.outputs.private_subnets
  public_network_acl_id  = dependency.network_acl.outputs.network_acls["public"].id
  private_network_acl_id = dependency.network_acl.outputs.network_acls["private"].id
}
```

---

### `network_acl_rule/terragrunt.hcl`

```hcl
terraform {
  source = "git::https://github.com/<org>/terraform-modules.git//resources/vpc/network_acl_rule?ref=v0.0.x"
}

dependency "network_acl" {
  config_path = "../network_acl"
}

inputs = {
  public_network_acl_id  = dependency.network_acl.outputs.network_acls["public"].id
  private_network_acl_id = dependency.network_acl.outputs.network_acls["private"].id

  public_rules = {
    ingress-all = { rule_number = 100, egress = false, protocol = "-1", rule_action = "allow", cidr_block = "0.0.0.0/0" }
    egress-all  = { rule_number = 100, egress = true,  protocol = "-1", rule_action = "allow", cidr_block = "0.0.0.0/0" }
  }

  private_rules = {
    ingress-all = { rule_number = 100, egress = false, protocol = "-1", rule_action = "allow", cidr_block = "0.0.0.0/0" }
    egress-all  = { rule_number = 100, egress = true,  protocol = "-1", rule_action = "allow", cidr_block = "0.0.0.0/0" }
  }
}
```
