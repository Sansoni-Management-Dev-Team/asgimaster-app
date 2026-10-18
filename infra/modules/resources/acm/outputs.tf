output "certificates" {
  description = "Map of certificate key to certificate attributes."
  value = {
    for key, cert in aws_acm_certificate.this : key => {
      arn                       = cert.arn
      domain_name               = cert.domain_name
      subject_alternative_names = cert.subject_alternative_names
      domain_validation_options = cert.domain_validation_options
      status                    = cert.status
    }
  }
}
