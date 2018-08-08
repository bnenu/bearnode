const _data = require('./data')
const { validateString } = require('./validations')
const { Maybe, safeProp } = require('../helpers')


// checkPhoneAndExp :: String -> {} -> Boolean
const checkPhoneAndExp = phone => data => (data.phone === phone && data.expires > Date.now())

// verifyToken :: String -> String -> Boolean
const verifyToken = phone => tokenId => {
  _data.read('tokens', tokenId, (err, data) => {

    return (err || !data) ? false : checkPhoneAndExp(phone)(data)
  })
}

// authenticate :: ({}, String, (Boolean -> a)) -> Boolean
const authenticate = (data, phone, cb) => {
  //const { token } = data.headers
  //const authToken = validateString(20)(token)

  const isAuthenticated = 
    Maybe.of(data)
      .chain(safeProp('headers'))
      .chain(safeProp('token'))
      .map(validateString(20))
      .map(verifyToken(phone))
      .option(false)

  cb && cb(isAuthenticated)
  return isAuthenticated
}

module.exports = authenticate
