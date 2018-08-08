const handlers = require('./handlers')

// routing
module.exports = {
  'checks': handlers.checks,
  'ping': handlers.ping,
  'users': handlers.users,
  'tokens': handlers.tokens,
  'notFound': handlers.notFound
}
