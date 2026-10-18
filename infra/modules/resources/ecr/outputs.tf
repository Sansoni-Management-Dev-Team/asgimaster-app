output "repositories" {
  description = "Map of repository key to repository attributes."
  value = {
    for key, repo in aws_ecr_repository.this : key => {
      arn            = repo.arn
      registry_id    = repo.registry_id
      repository_url = repo.repository_url
      name           = repo.name
    }
  }
}
