output "listeners" {
  description = "Map of listener key to listener attributes."
  value = {
    for key, listener in aws_lb_listener.this : key => {
      arn = listener.arn
    }
  }
}
