output "identity_store_id" {
  description = "ID of the IAM Identity Center identity store."
  value       = tolist(data.aws_ssoadmin_instances.this.identity_store_ids)[0]
}

output "instance_arn" {
  description = "ARN of the IAM Identity Center instance."
  value       = tolist(data.aws_ssoadmin_instances.this.arns)[0]
}
