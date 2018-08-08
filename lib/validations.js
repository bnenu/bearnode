const {
  compose, hasMinLen,
  isType, isNil, match, not,
  trim
} = require('../helpers')

// data validation
const testString = len => ([
  [ false, isNil ],
  [ false, compose(not, isType('string')) ],
  [ false, compose(not, hasMinLen(len)) ]
])

const testBool = [
  [ false, isNil ],
  [ false, compose(not, isType('boolean')) ]
]

const validateString = len => data =>
  match(testString(len))(trim(data)).option(trim(data))

const validateBool = data =>
  match(testBool)(trim(data)).option(trim(data))

module.exports = {
  validateString,
  validateBool
}
