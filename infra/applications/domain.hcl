locals {
  # asgi.pajamaprofits.net is the internal staging domain.
  develop = {
    zone_name = "asgi.pajamaprofits.net"
    app_host  = "app.asgi.pajamaprofits.net"
  }
  # production = {
  #   zone_name = "" # TODO: production domain is still being decided
  #   app_host  = ""
  # }
}
