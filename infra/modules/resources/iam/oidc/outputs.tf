output "oidc_providers" {
  description = "Map of OIDC provider key to provider attributes."
  value = {
    for key, provider in aws_iam_openid_connect_provider.this : key => {
      arn = provider.arn
      url = provider.url
    }
  }
}
