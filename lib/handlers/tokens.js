// Deps
const {
  createRandomString, log
} = require('../../helpers')
const { hash } = require('../encrypt')
const _data = require('../data')
const _authenticate = require('../auth')
const { validateString, validateBool } = require('../validations')
const { getHandler } = require('./utils')

/*
 * Tokens handlers
 *
 */

const accept = [
  'post',
  'get',
  'put',
  'delete'
]
const _tokens = {}

const tokens = (data, cb) => getHandler(accept, _tokens, data, cb)()


// Tokens - post
// Required payload: phone, password
// Optional payload: none
_tokens.post = (data, cb) => {
  const { phone, password } = data.payload
  const auth = {
    phone: validateString(5)(phone),
    password: validateString(3)(password)
  }

  if(!auth.phone && !auth.password) {
    return cb(400, { 'Error': 'Missing required field(s)' })
  }

  _data.read('users', auth.phone, (err, userData) => {
    if(err || !userData) {
      return cb(400, { 'Error': 'User not found' })
    }

    if(hash(auth.password) !== userData.password) {
      return cb(400, { 'Error': 'Password does not match' })
    }

    const tokenId = createRandomString(20)
    const expires = Date.now() + 1000 * 60 * 60
    const tokenObject = {
      phone: auth.phone,
      id: tokenId,
      expires: expires
    }

    _data.create('tokens', tokenId, tokenObject, err => {
      if(err) {
        return cb(500, { 'Error': 'Could not create auth token' })
      }

      return cb(200, tokenObject)
    })

  })
}

// Tokens - get
// Required params: tokenId
// Optional params: none
_tokens.get = (data, cb) => {
  const { tokenId } = data.params
  const id = validateString(20)(tokenId)

  if(id) {
    _data.read('tokens', id, (err, tokenData) => {
      if(err || !tokenData) {
        log(err)
        return cb(404, { 'Error': 'Token not found' })
      }

      return cb(200, tokenData)
    })
  } else {
    return cb(400, { 'Error': 'Missing tokenId param' })
  }
}

// Tokens - put
// Required payload: tokenId, extend
// Optional payload: none
_tokens.put = (data, cb) => {
  const { tokenId, extend } = data.payload
  const t = {
    id: validateString(20)(tokenId),
    extend: validateBool(extend)
  }

  if(!t.id || !t.extend) {
    return cb(400, { 'Error': 'Missing required field(s) or invalid format' })
  }

  _data.read('tokens', t.id, (err, tokenData) => {
    if(err || !tokenData) {
      return cb(400, { 'Error': 'Token does not exists' })
    }

    if(tokenData.expires < Date.now()) {
      return cb(400, { 'Error': 'token already expired' })
    }

    tokenData.expires = Date.now() + 1000 * 60 * 60

    _data.update('tokens', t.id, tokenData, err => {
      if(err) {
        return cb(500, { 'Error': 'Could not update expiring time' })
      }

      return cb(200, tokenData)
    })
  })
}

// Tokens - delete
// Required params: tokenId
// Optional params: none
_tokens.delete = (data, cb) => {
  const { tokenId } = data.params
  const t = validateString(20)(tokenId)

  if(t) {
    _data.read('tokens', t, (err, tokenData) => {
      if(err || !tokenData) {
        log(err)
        return cb(400, { 'Error': 'Token not found' })
      }

      _data.delete('tokens', t, err => {
        if(err) {
          return cb(500, { 'Error': 'Token could not be deleted' })
        }

        return cb(200)
      })
    })
  } else {
    return cb(400, { 'Error': 'Missing tokenId param' })
  }
}

module.exports = tokens
