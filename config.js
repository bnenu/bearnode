const { isType, safeIs } = require('./helpers')

const environments = {
  development: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: 'development',
    hashSecret: 's0m3S3cr3tH@sh',
    maxChecks: 5
  },
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: 'staging',
    hashSecret: 's0m3S3cr3tH@sh',
    maxChecks: 5
  },
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: 'production',
    hashSecret: 's0m3S3cr3tH@sh',
    maxChecks: 5
  }
}

const current = safeIs(isType('string'))('')(process.env.NODE_ENV)
  //isType('string')(process.env.NODE_ENV) ? process.env.NODE_ENV.toLowerCase() : ''

const envToExport = safeIs(isType('object'))(environments.staging)(environments[current])
  //isType('object')(environments[current]) ? environments[current] : environments.staging

module.exports = envToExport
