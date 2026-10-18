output "vpc_id" {
  description = "ID of the VPC matching the tag filter."
  value       = data.aws_vpc.this.id
}
