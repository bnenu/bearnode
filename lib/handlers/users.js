// Deps
const {
  Maybe, assoc, log, compose, composePreds, chain, curry2, hasMinLen, identity, isType, ifElse, isTrue, map, maybeToAsync, objOf, omit, safeProp
} = require('../../helpers')
const { safeHashKey } = require('../encrypt')
const _data = require('../data')
const { _authenticate, authWithPhone } = require('../auth')
const { validateString, allPass } = require('../validations')
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

const validations = {
  firstName: composePreds(isType('string'), hasMinLen(1)),
  lastName: composePreds(isType('string'), hasMinLen(1)),
  phone: composePreds(isType('string'), hasMinLen(5)),
  password: composePreds(isType('string'), hasMinLen(4)),
  tosAgreement: composePreds(isType('boolean'), isTrue)
}

const readUser = curry2(_data.read)('users')
const createUser = curry2(_data.create)('users')

// alreadyUser :: String -> Maybe {} -> Async Error {}
const getExistingUser = idKey => compose(
  chain(readUser),
  maybeToAsync(`No user ${idKey} found!`),
  chain(safeProp(idKey))
)

// exitWithError :: (a -> ()) -> Number -> String -> {}
const exitWithError = cb =>  (code, reason) => {
  cb(code, { 'Error': reason })

  return {}
}

// Users - post
// Required payload: firstName, lastName, phone, password, tosAgreement
// Optional payload: none
_users.post = (data, cb) => {
  const required = [ 'firstName', 'lastName', 'phone', 'password', 'tosAgreement' ]
  const exit = exitWithError(cb)

  // addHashedPassword :: {} -> Maybe {}
  const addHashedPassword =
    data => safeHashKey('password')(data)
      .map(hash => assoc(data)(objOf('password')(hash)))

  // newUserFlow = Maybe {} -> Async Error User
  const newUserFlow = compose(
    map(omit(['password'])),
    chain(data => createUser(data.phone, data)),
    maybeToAsync('Password could not be hashed'),
    chain(addHashedPassword)
  )

  // Params: request payload
  // reqIsValid :: {} -> Boolean
  const reqIsValid = allPass(required)(validations)

  // Params: request payload
  // altFlow :: {} -> ()
  const altFlow = data =>
    getExistingUser('phone')(data)
      .map(() => [ 400, 'User already exists' ])
      .alt(newUserFlow(data).map(x => [ 201, x ]))
      .fork(
        err => exit(500, err),
        user => user[0] === 400 ? exit(...user) : cb(...user)
      )

  // Params: request payload
  // run :: {} -> ()
  const run = ifElse(reqIsValid)(
    payload => altFlow(Maybe.of(payload))
  )(() => exit(400, 'Missing required fields'))

  return run(data.payload)
}

// Users - get
// Required params: phone
// Optional params: none
_users.get = (data, cb) => {
  const required = [ 'phone' ]
  const exit = exitWithError(cb)

  // authFlow :: {} -> {} -> Async (Number, Err) (Number, Boolean)
  const authFlow = 
    data => params =>
      authWithPhone(data)(params)
        .bimap(
          err => [ 403, err ],
          identity
        )

  // userFlow :: {} -> Async (Number, Error) (Number, User)
  const userFlow =
    params =>
      getExistingUser('phone')(params)
        .map(omit(['password']))
        .bimap(
          err => [ 404, err ],
          user => [ 200, user ]
        )

  // execFlow :: {} -> ()
  const execFlow =
    data => params =>
      authFlow(data)(params)
        .chain(() => userFlow(params))
        .fork(
          err => exit(...err),
          userResponse => cb(...userResponse)
        )

  const reqIsValid = allPass(required)(validations)

  const run = data => ifElse(reqIsValid)(
    (params) => execFlow(data)(params)
  )(() => exit(400, 'Missing required params'))(data.params)

  return run(data)
  ////////
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

  ////////
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
