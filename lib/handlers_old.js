/*
 * Routing handlers
 */

// Deps
const {
  Maybe,
  compose, createRandomString, hasMinLen,
  isType, isNil, log, match, not, tagValue,
  trim
} = require('../helpers')
const { hash } = require('./encrypt')
const _data = require('./data')

// data validation
const testString = len => ([
  [false, isNil],
  [false, compose(not, isType('string'))],
  [false, compose(not, hasMinLen(len))]
])

const testBool = [
  [false, isNil],
  [false, compose(not, isType('boolean'))]
]

const validateString = len => data =>
  match(testString(len))(trim(data)).option(trim(data))
  //isType('string')(data) && hasMinLen(1)(data.trim()) ? data.trim() : false

const validateBool = data =>
  match(testBool)(trim(data)).option(trim(data))

// Handlers
const handlers = {}

/*
 * Ping handlers
 *
 */
handlers.ping = (data, cb) => {
  return cb(200)
}

/*
 * Users handlers
 *
 */
handlers.users = (data, cb) => {
  const acceptableMethods = [ 'post', 'get', 'put', 'delete' ]

  if(acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, cb)
  } else {
    return cb(405)
  }
}

handlers._users = {}
// Users - post
// Required payload: firstName, lastName, phone, password, tosAgreement
// Optional payload: none
handlers._users.post = (data, cb) => {
  const { firstName, lastName, phone, password, tosAgreement } = data.payload
  const user = {
    firstName: validateString(1)(firstName),
    lastName: validateString(1)(lastName),
    phone: validateString(5)(phone),
    password: validateString(3)(password),
    tosAgreement: validateBool(tosAgreement)
  }

  if(user.firstName && user.lastName && user.phone && user.password && user.tosAgreement) {
    _data.read('users', user.phone, (err, u) => {
      if(err) {
        const hashed = hash(password)

        if(hashed) {
          user.password = hashed

          _data.create('users', user.phone, user, err => {
            if(err) {
              return cb(500, { 'Error': 'User could not be saved' })
            } else{
              return cb(201, user)
            }
          })
        } else {
          return cb(500, { 'Error': 'Password could not be hashed' })
        }
      } else {
        return cb(400, { 'Error': 'User with this phone number already exists.' })
      }
    })
  } else {
    return cb(400, { 'Error': 'Missing required fields or invalid format.' })
  }
}

// Users - get
// Required params: phone
// Optional params: none
handlers._users.get = (data, cb) => {
  const phone = validateString(5)(data.queryParams.phone)

  if(phone) {
    _handlers._authenticate(data, phone, (authSuccess) => {
      if(!authSuccess) {
        return cb(403, { 'Error': 'Authentication failed' })
      }

      _data.read('users', phone, (err, userData) => {
        if(err || !userData) {
          log(err)
          return cb(404, { 'Error': 'User not found' })
        }

        delete userData.password
        return cb(200, userData)
      })
    })
  } else {
    return cb(400, { 'Error': 'Missing phone param' })
  }
}

// Users - put
// Required payload: phone
// Optional payload: firstName, lastName, password (at least one is required)
handlers._users.put = (data, cb) => {
  const { phone, firstName, lastName, password } = data.payload

  const u = {
    phone: validateString(5)(phone),
    firstName: validateString(1)(firstName),
    lastName: validateString(1)(lastName),
    password: validateString(3)(password)
  }

  if(!u.phone) {
    return cb(400, { 'Error': 'Missing phone field' })
  }

  if(u.firstName || u.lastName || u.password) {
    _handlers._authenticate(data, u.phone, (authSuccess) => {
      if(!authSuccess) {
        return cb(403, { 'Error': 'Authentication failed' })
      }

      _data.read('users', phone, (err, userData) => {
        if(err || !userData) {
          return cb(404, { 'Error': 'User not found' })
        }

        userData.firstName = u.firstName ? u.firstName : userData.firstName
        userData.lastName = u.lastName ? u.lastName : userData.lastName

        const hashed = hash(u.password)
        userData.password = hashed ? hashed : userData.password

        _data.update('users', phone, userData, err => {
          if(err) {
            log(err)
            return cb(500, { 'Error': 'Could not update user' })
          }

          delete userData.password
          return cb(200, userData)
        })
      })
    })
  } else {
    return cb(400, { 'Error': 'Missing fields to update' })
  }
}

// Users - delete
// Required params: phone
// Optional params: none
// @TODO Delete also associated files
handlers._users.delete = (data, cb) => {
  const phone = validateString(5)(data.queryParams.phone)

  if(phone) {
    _handlers._authenticate(data, phone, (authSuccess) => {
      if(!authSuccess) {
        return cb(403, { 'Error': 'Authentication failed' })
      }

      _data.read('users', phone, (err, userData) => {
        if(err || !userData) {
          log(err)
          return cb(400, { 'Error': 'User not found' })
        }

        _data.delete('users', phone, err => {
          if(err) {
            return cb(500, { 'Error': 'User could not be deleted' })
          }

          delete userData.password
          return cb(200, userData)
        })
      })
    })
  } else {
    return cb(400, { 'Error': 'Missing phone param' })
  }
}

/*
 * Tokens handlers
 *
 */
handlers.tokens = (data, cb) => {
  const acceptableMethods = [ 'post', 'get', 'put', 'delete' ]

  if(acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, cb)
  } else {
    return cb(405)
  }
}

handlers._tokens = {}
// Tokens - post
// Required payload: phone, password
// Optional payload: none
handlers._tokens.post = (data, cb) => {
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
handlers._tokens.get = (data, cb) => {
  const { tokenId } = data.queryParams
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
handlers._tokens.put = (data, cb) => {
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
handlers._tokens.delete = (data, cb) => {
  const { tokenId } = data.queryParams
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

handlers._authenticate = (data, phone, cb) => {
  const { token } = data.headers
  const authToken = validateString(20)(token)

  if(handlers_tokens.verifyToken(authToken, phone)) {
    return cb(true)
  } else {
    return cb(false)
  }
}

handlers._tokens.verifyToken = (tokenId, phone) => {
  _data.read('tokens', tokenId, (err, data) => {
    if(err || !data) {
      return false
    }

    if(data.phone === phone && data.expires > Date.now()) {
      return true
    }

    return false
  })
}

/*
 * Not found handler
 *
 */
handlers.notFound = (data, cb) => {
  return cb(404)
}

module.exports = handlers
