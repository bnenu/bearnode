const crypto = require('crypto')
const config = require('../config')
const { Maybe, compose, chain, isType, hasMinLen, safeProp } = require('../helpers')

// hashing
// hash :: String -> String | Boolean
const hash = str => {

  return isType('string')(str) && hasMinLen(1)(str)
    ? crypto.createHmac('sha256', config.hashSecret).update(str).digest('hex')
    : false
}

// safeHash :: String -> Maybe String
const safeHash = str => Maybe.safe(hash)(str).map(hash)

// safeHashKey :: String -> {} -> Maybe String
const safeHashKey = key => compose(
  chain(safeHash),
  chain(Maybe.safe(isType('string'))),
  safeProp(key)
)
module.exports = {
  hash, safeHash, safeHashKey
}

