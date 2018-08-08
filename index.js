// Deps
const fs = require('fs')
const config = require('./config')
const { httpServer, httpsServer } = require('./lib/server')
const router = require('./lib/router')
const { log } = require('./helpers')


// Server HTTPS Options
const httpsOptions = {
  'key': fs.readFileSync('./https/key.pem'),
  'cert': fs.readFileSync('./https/cert.pem')
}

// Servers Up
httpServer(router).listen(
  config.httpPort,
  (x) => log(`HTTP server listening on port ${config.httpPort} in ${config.envName} mode with ${x}`))


httpsServer(httpsOptions, router).listen(
  config.httpsPort,
  () => log(`HTTPS server listening on port ${config.httpsPort} in ${config.envName} mode`))

