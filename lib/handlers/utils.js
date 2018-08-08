//Deps
const {
  Maybe, contains, constant, flip, safeProp
} = require('../../helpers')

const { safe } = Maybe

// getHandler :: [ String ] -> {} -> a -> ((Error, a) -> ()) -> (() -> ())
const getHandler = (accept, handlers, data, cb) => {
  const isAccepted = flip(contains)(accept)

  const lazy = safeProp('method')(data)
    .chain(safe(isAccepted))
    .chain(m => safeProp(m)(handlers))
    .map(handler => (x, fn) => () => handler(x, fn))
    .option(constant(() => cb(405)))

  return lazy(data, cb)
}

module.exports = {
  getHandler
}
