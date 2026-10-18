output "keys" {
  description = "Map of key identifier to KMS key attributes."
  value = {
    for key, k in aws_kms_key.this : key => {
      key_id     = k.key_id
      arn        = k.arn
      alias_name = aws_kms_alias.this[key].name
      alias_arn  = aws_kms_alias.this[key].arn
    }
  }
}
