const _data = require('./data')
const { validateString } = require('./validations')
const { Async, Maybe, chain, compose, curry2, map, maybeToAsync, safeProp } = require('../helpers')


// checkPhoneAndExp :: String -> {} -> Boolean
const checkPhoneAndExp = phone => data => (data && data.phone === phone && data.expires > Date.now())

// verifyToken :: String -> String -> Async Err Boolean
const verifyToken = phone => tokenId => {
  return _data.read('tokens', tokenId)
    .map(checkPhoneAndExp(phone))
}

// authenticate :: ({}, String, (Boolean -> a)) -> Boolean
const authenticate = (data, phone, cb) => {

  // getValidToken :: {} -> String
  const getValidToken = compose(
    map(validateString(20)),
    safeProp('token'),
    safeProp('headers')
  )


  if(cb) {
    const tokenId = getValidToken(data).option(false)
    
    if(tokenId) {
      _data.read('tokens', tokenId, (err, tokenData) => {
        if(err || !tokenData) {
          return cb(false)
        }

        return cb(checkPhoneAndExp(phone)(tokenData))
      })
    }

    return cb(false)
  }

  // asyncAuthFlow :: {} -> Async Err Boolean
  const asyncAuthFlow = compose(
    chain(x => x 
      ? Async((_, res) => res(x)) 
      : Async((rej) => rej('Authentication failed'))),
    chain(verifyToken(phone)),
    maybeToAsync('Missing or invalid token'),
    getValidToken
  )
  
  return asyncAuthFlow(data)
}

/*
 Takes the full request as first param 
 and the pbject containing the phone to check as second param
 *
 */

// authWithPhone :: {} -> {} -> Async Error Boolean
const authWithPhone =
  data => compose(
    chain(curry2(authenticate)(data)),
    maybeToAsync('Missing phone param'),
    safeProp('phone')
  )

module.exports = {
  _authenticate: authenticate,
  authWithPhone
}
