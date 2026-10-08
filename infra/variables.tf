variable "project" {
  description = "Name prefix for every resource and the value of the Project tag."
  type        = string
  default     = "mlai-sansoni"
}

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-southeast-2"
}

variable "image_tag" {
  description = "Tag of the API image in ECR to run. Tags are immutable, so use the git SHA."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class for Postgres."
  type        = string
  default     = "db.t4g.micro"
}
