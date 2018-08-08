const crypto = require('crypto')
const config = require('../config')
const { isType, hasMinLen } = require('../helpers')

// hashing
const hash = str => {

  return isType('string')(str) && hasMinLen(1)(str)
    ? crypto.createHmac('sha256', config.hashSecret).update(str).digest('hex')
    : false
}

module.exports = {
  hash
}

