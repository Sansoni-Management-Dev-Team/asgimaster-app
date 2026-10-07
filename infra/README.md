# Infrastructure

Terraform for the AWS resources that run the API. This is a minimal first version with one environment. It has not been applied to any AWS account yet.

## What it creates

Every resource has a `Project` tag. The Terraform also creates an AWS resource group that lists everything with that tag.

**Network**

- A VPC with two public subnets and two private subnets, in two availability zones.
- An internet gateway and a route table for the public subnets.
- There is no NAT Gateway. The API containers run in the public subnets with public IP addresses, and security groups only let traffic in from the load balancer. This saves the monthly cost of a NAT Gateway.

**API**

- An ECR repository for the API image. Image tags cannot be overwritten, so tag each image with its git commit SHA.
- An ECS cluster and a Fargate service running one ARM task with 0.25 vCPU and 512 MB of memory.
- An application load balancer that listens on HTTP port 80 and checks `/health`.
- A CloudWatch log group that keeps logs for 30 days.
- An IAM role that lets ECS pull the image, write logs and read the database password.

**Database**

- RDS Postgres 18 on a `db.t4g.micro` instance with 20 GB of gp3 storage, in a single availability zone.
- The database is in the private subnets and only accepts connections from the API containers.
- RDS creates the master password and stores it in Secrets Manager.
- Backups are kept for 7 days. Deletion protection is on, and RDS takes a final snapshot if the database is deleted.

## Not included yet

- HTTPS. This needs a domain name and an ACM certificate. iOS blocks plain HTTP by default, so the mobile app cannot call the API until this is added.
- Automatic deploys. `.github/workflows/deploy-api.yml` is a stub that fails with "not implemented". Its comments list the planned steps.
- A second environment, e.g., staging.

## First deploy

You need AWS credentials for the target account and an existing S3 bucket for Terraform state.

1. Copy `backend.hcl.example` to `backend.hcl` and set the bucket name.
2. Copy `terraform.tfvars.example` to `terraform.tfvars`.
3. Run `terraform init -backend-config=backend.hcl`.
4. Create the ECR repository on its own first, because the ECS service needs an image to start.

   ```sh
   terraform apply -target=aws_ecr_repository.api
   ```

5. Build the API image for ARM, tag it with the git SHA and push it to the repository URL from step 4.
6. Set `image_tag` in `terraform.tfvars` to that SHA, then run `terraform apply`.
7. Open the `api_url` output followed by `/health` to check that the API is running.

To deploy a new version, push a new image and run `terraform apply` with the new `image_tag`.
