// Deps
const {
  log
} = require('../../helpers')
const { hash } = require('../encrypt')
const _data = require('../data')
const _authenticate = require('../auth')
const { validateString, validateBool } = require('../validations')
const { getHandler } = require('./utils')
/*
 * Users handlers
 *
 */

const accept  = [
  'post',
  'get',
  'put',
  'delete'
]
const _users = {}

const users = (data, cb) => getHandler(accept, _users, data, cb)()


// Users - post
// Required payload: firstName, lastName, phone, password, tosAgreement
// Optional payload: none
_users.post = (data, cb) => {
  const { firstName, lastName, phone, password, tosAgreement } = data.payload
  const user = {
    firstName: validateString(1)(firstName),
    lastName: validateString(1)(lastName),
    phone: validateString(5)(phone),
    password: validateString(3)(password),
    tosAgreement: validateBool(tosAgreement)
  }

  if(user.firstName && user.lastName && user.phone && user.password && user.tosAgreement) {
    _data.read('users', user.phone, (err, user) => {
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
_users.get = (data, cb) => {
  const phone = validateString(5)(data.params.phone)

  if(phone) {
    _authenticate(data, phone, (authSuccess) => {
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
_users.put = (data, cb) => {
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
    _authenticate(data, u.phone, (authSuccess) => {
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
_users.delete = (data, cb) => {
  const phone = validateString(5)(data.params.phone)

  if(phone) {
    _authenticate(data, phone, (authSuccess) => {
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

module.exports = users
