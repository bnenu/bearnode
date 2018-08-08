//Deps
const _data = require('../data')
const { getHandler } = require('./utils')
const {
  All, compose, composePreds, contains, flip,
  hasMinLen, isArray, isType, log,
  mapObj, mapProps, mconcat, pick, safeIs
} = require('../../helpers')

const accept = [
  'post',
  'get',
  'put',
  'delete'
]

const _checks = {}

const checks = (data, cb) => getHandler(accept, _checks, data, cb)()
const validations = {
  protocol: composePreds(
    isType('string'),
    flip(contains)(['http', 'https'])
  ),
  url: composePreds(
    isType('string'),
    hasMinLen(1)
  ),
  method: composePreds(
    isType('string'),
    flip(contains)(['post', 'get', 'put', 'delete'])
  ),
  successCodes: composePreds(
    isArray,
    hasMinLen(1)
  ),
  timeoutSeconds: composePreds(
    isType('number'),
    x => x % 1 === 0,
    x => x >= 1 && x <= 5
  )
}

// checkWith :: [ String ] -> {} -> {}
const checkWith = keysToValidate => compose(
  mapObj((check) => safeIs(check)(false)),
  pick(keysToValidate)
)

const validate = (required, validations) => compose(
  x => Object.keys(x).map(k => x[k]),
  mapProps(checkWith(required)(validations)),
  pick(required)
)

const all = required => validations => compose(
  x => x.valueOf(),
  mconcat(All),
  validate(required, validations)
)

// Checks - post
// Required payload: protocol, url, method, successCodes, timeoutSeconds
// Optional payload: none
_checks.post = (data, cb) => {
  // Validate inputs
  const required = [ 'protocol', 'url', 'method', 'successCodes', 'timeoutSeconds']


  if(!all(required)(validations)(data.payload)) {
    cb(400, { Error: 'Missing or wrong format of required params' })
  } else {
    cb(201)
  }
}
// Checks - get
// Required payload:
// Optional payload:
_checks.get = (data, cb) => {}

// Checks - put
// Required payload:
// Optional payload:
_checks.put = (data, cb) => {}

// Checks - delete
// Required payload:
// Optional payload:
_checks.delete = (data, cb) => {}


module.exports = checks
