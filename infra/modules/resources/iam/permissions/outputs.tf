output "policies" {
  description = "Map of policy key to policy attributes."
  value = {
    for key, policy in aws_iam_policy.this : key => {
      arn  = policy.arn
      name = policy.name
      id   = policy.id
    }
  }
}
