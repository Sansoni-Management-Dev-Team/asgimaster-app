resource "aws_db_subnet_group" "main" {
  name       = var.project
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "db" {
  name   = "${var.project}-db"
  vpc_id = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

# Smallest sensible Postgres: single AZ, Graviton micro instance, 20 GB gp3.
# RDS generates the master password and stores it in Secrets Manager.
resource "aws_db_instance" "main" {
  identifier     = var.project
  engine         = "postgres"
  engine_version = "18"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = "app"
  username                    = "app_admin"
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final"
}
