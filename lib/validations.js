const {
  All, compose, hasMinLen,
  isType, isNil, mapObj, mapProps, match, mconcat, not,
  safeIs, pick, trim
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

// checkWith :: [ String ] -> {} -> {}
const checkWith = keysToValidate => compose(
  mapObj((pred) => safeIs(pred)(false)),
  pick(keysToValidate)
)

// validateEach :: ([ String ], {}) -> {} -> [ Boolean ]
const validateEach = (required, validations) => compose(
  Object.values,
  mapProps(checkWith(required)(validations)),
  pick(required)
)

/*
 Takes a list of keys,
 an object with predicates for each of those keys,
 and an object containing those keys
 Returns true if all predicates pass otherwise false.
*/
// allPass :: [ String ] -> {} -> {} -> Boolean
const allPass = required => withValidations => compose(
  x => x.valueOf(),
  mconcat(All),
  validateEach(required, withValidations)
)
module.exports = {
  validateString,
  validateBool,
  allPass
}
