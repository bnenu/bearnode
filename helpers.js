
/*
 *
 * Pointfree helpers
 */

const curry2 = fn => (x, ...args) => {
  return args.length > 0
    ? fn(x, ...args)
    : (...y) => fn(x, ...y)
}

const curry3 = fn => (...args) => {
  return args.length > 2
    ? fn(...args)
    : args.length === 2
      ? x => fn(...args, x)
      : curry2((x, y) => fn(...args, x, y))
}

const tap = fn => x => {
  fn(x)

  return x
}

const log = (...x) => tap(console.log.bind(console))(...x)

const compose =
  (fn, ...rest) =>
    rest.length === 0 ? fn : (...x) => fn(compose(...rest)(...x))

const map =
  fn => x => x.map(fn)

const chain =
  fn => x => x.chain(fn)

const constant =
  x => y => x

const identity =
  x => x

const flip =
  fn => y => x => fn(x, y)

const replace =
  (regExp, x) => str => str.replace(regExp, x)


// objOf :: String -> a -> {}
const objOf = key => value => ({ [key]: value })

// assoc :: {} -> {} -> {}
const assoc = obj => more => Object.assign({}, obj, more)

// pick :: [ String ] -> {} -> {}
const pick =
  curry2(
    (keys, obj) =>
      keys.reduce(
        (acc, key) => assoc(acc)(objOf(key)(obj[key])), {}
      )
  )
// omit :: [ String ] -> {} -> {}
const omit =
  curry2(
    (keys, obj) => {
      let n = {}

      for(let k in obj) {
        if(!(keys.indexOf(k) > -1)){
          n[k] = obj[k]
        }
      }

      return n
    }
  )
// mapObj :: (a -> b) -> {} -> {}
const mapObj = curry2(
  (fn, obj) => {
    let n = {}
    const f = curry3(fn)

    for(let key in obj) {
      n[key] = f(obj[key], key, obj)
    }

    return n
  }
)

// mapProps :: { (a -> b) } -> {} -> {}
const mapProps = curry2((mappings, obj) => {
  let n = {}

  for(let key in mappings) {
    if(isType('function')(mappings[key])) {
      n[key] = mappings[key](obj[key])
    }
  }

  return Object.assign({}, obj, n)
})

/*
 *
 * Predicates and validators
 */

// composePreds :: [ preds ] -> x -> Boolean
const composePreds =
  (...preds) => x =>
    preds.reduce((acc, p) => acc === false ? false : p(x), true)

// isType :: String -> a -> Boolean
const isType = type => x => typeof x === type

// isArray :: a -> Boolean
const isArray = x => Array.isArray(x)

// isTrue :: Boolean -> Boolean
const isTrue = x => x === true ? true : false

// isFalse :: Boolean -> Boolean
const isFalse = x => x === false ? true : false

// not :: a -> Boolean
const not = x => !x

// isNotNil :: a -> Boolean
const isNotNil = x => (x !== undefined && x !== null)

// isNil :: a -> Boolean
const isNil = x => (x === undefined || x === null)

// hasMinLen :: Number -> String|Array -> Boolean
const hasMinLen = min => x => (isType('string')(x) || isArray(x)) ? x.length >= min : false

// trim :: String -> String
const trim = x => isType('string')(x) ? x.trim() : x

// safeIs :: (a -> Boolean) -> b -> a -> a|b
const safeIs = pred => option => x => pred(x) ? x : option

// ifElse :: pred -> ((a -> b), (a -> b)) -> a -> b
const ifElse = pred => f => g => x => pred(x) ? f(x) : g(x)

/*
 *
 * Poor man's ADTs
 */

const isSameType = (M, x) => M['@@type'] === x['@@type']

// Maybe
const Just = val => ({
  toString: () => `Just(${val})`,
  isJust: () => true,
  isNothing: () => false,
  map: fn => Just(fn(val)),
  chain: fn => fn(val),
  ap: M => M.map(val),
  option: () => val,
  ['@@type']: '@@maybe'
})

const Nothing = () => ({
  toString: () => 'Nothing',
  isJust: () => false,
  isNothing: () => true,
  map: () => Nothing(),
  chain: () => Nothing(),
  ap: () => Nothing(),
  option: defaultValue => defaultValue,
  ['@@type']: '@@maybe'
})

const Maybe = {
  Just: Just,
  Nothing: Nothing,
  of: val => Maybe.Just(val),
  safe: pred => val => pred(val) ? Maybe.Just(val) : Maybe.Nothing(),
  option: val => M => M.option(val),
  ['@@type']: '@@maybe'
}

// Reader
const Reader = function Reader(runWith) {
  const _of = x => Reader(() => x)

  return {
    of: _of,
    runWith: runWith,
    map: fn => Reader(compose(fn, runWith)),
    chain: fn => Reader(env => fn(runWith(env)).runWith(env)),
    ap: R => Reader(env => R.map(runWith(env)).runWith(env))
  }
}

// Async
const Async = function(fn) {
  const _of = x => Async((_, resolve) => resolve(x))
  const fork = (reject, resolve) => fn(x => reject(x), x => resolve(x))
  const map = f => Async((rej, res) => fork(
    rej,
    compose(res, f))
  )
  const chain = f => Async((rej, res) => fork(rej, x => f(x).fork(rej, res)))

  const alt = A => Async((rej, res) => fork(
    () => A.fork(rej, res),
    res
  ))

  const bimap = (f, g) => Async((rej, res) => fork(
    compose(rej, f),
    compose(res, g)
  ))

  return {
    of: _of,
    fork: fork,
    map: map,
    chain: chain,
    alt: alt,
    bimap: bimap
  }
}

// maybeToAsync :: a -> Maybe b -> Async a b
const maybeToAsync =
  rejectionOpt => Maybe =>
    Async((rej, res) => {
      Maybe.isJust() ? res(Maybe.option()) : rej(rejectionOpt)
    })

const A = Async((rej, res) => {
  //rej('Reject A')
  res(false)
})
const B = x => Async((rej, res) => {
  x ? res('Resolve B') : rej('Reject B')
})

A.chain(x => B(x)).fork(log, log)

// Monoids
const All = (val) => ({
  toString: () => 'All',
  empty: () => All(true),
  concat: A => {
    return All(A.valueOf() && !!val)
  },
  valueOf: () => !!val,
  ['@@type']: '@@all'
})

const First = (val) => ({
  toString: () => 'First',
  empty: () => First(Maybe.Nothing()),
  concat: (F) => {
    const v = isSameType(Maybe, val) ? val : Maybe.of(val)

    return v.toString() === 'Nothing' ? F : First(v)
  },
  valueOf: () => isSameType(Maybe, val) ? val : Maybe.of(val),
  option: opt => isSameType(Maybe, val) ? val.option(opt) : Maybe.of(val).option(opt),
  ['@@type']: '@@first'
})

const Last = (val) => ({
  toString: () => 'Last',
  empty: () => Last(Maybe.Nothing()),
  concat: (L) => {
    const v = isSameType(Maybe, val) ? val : Maybe.of(val)

    return L.valueOf().toString() === 'Nothing' ? Last(v) : L
  },
  valueOf: () => isSameType(Maybe, val) ? val : Maybe.of(val),
  option: opt => isSameType(Maybe, val) ? val.option(opt) : Maybe.of(val).option(opt),
  ['@@type']: '@@last'
})

const reduceWith = M => (acc, val) => acc.concat(M(val))

// mconcat :: Monoid m => m -> [ a ] -> m a
const mconcat =
  M => xs =>
    xs.reduce(
      reduceWith(compose(M, x => x)),
      M().empty()
    )

// mconcatMap :: Monoid m => m -> (a -> b) -> [ a ] -> m b
const mconcatMap =
  M => fn => xs =>
    xs.reduce(
      reduceWith(compose(M, fn)),
      M().empty()
    )

// mreduceMap :: Monoid m => m -> (a -> b) -> [ a ] -> b
const mreduceMap =
  M => fn => xs =>
    xs.reduce(reduceWith(compose(M, fn)), M().empty()).valueOf()

// safeProp :: String -> {} -> Maybe a
const safeProp = key => data => prop(key)(data) ? Maybe.Just(prop(key)(data)) : Maybe.Nothing()

// prop :: String -> {} -> a
const prop = propName => obj => obj[propName]

// contains :: String|Number -> [ String|Number ] -> Boolean
const contains = (x, xs) => xs.indexOf(x) > -1

/*
 *
 * Tagging and matching
 */

//log(
//  'compose preds:',
//  composePreds(hasMinLen(2), isType('string'))('abc')
//)

// tagValue :: ([ a, f ]) -> x -> Maybe a
const tagValue = curry2(
  ([tag, pred], x) => compose(map(constant(tag)), Maybe.safe(pred))(x)
)

// match :: [ [ a,  f] ] -> x -> Maybe a
const match = preds => x => mreduceMap(First)(flip(tagValue)(x))(preds)

//const taggedPreds = [
//  ['big', hasMinLen(10)],
//  ['med', hasMinLen(5)],
//  ['small', hasMinLen(1) ],
//]
// Ex:
//log(match(taggedPreds)('').toString())

// matcher = [ [ preds ], execution ]

const pmatch = x => (...matchers) => {
  const m = matchers.filter(([ preds, f ]) => {
    const test = preds
      .map((p, i) => p(x[i]))
      .reduce((acc, x) => acc === false ? false : x, true)

    return test
  })

  const [ preds, execute ] = m[0]

  return execute(x)
}

//pmatch([true, 'blsbla'])(
//  [ [ isFalse, isType('object') ], (x) => { console.log('error') } ],
//  [ [ isTrue, isType('string') ], (x) => { console.log('wrong data') } ],
//  [ [ isTrue, isType('object') ], (x) => { console.log('match') } ]
//)


/*
 *
 * Parsers
 */

// parseJsonToObj :: String -> { a }
const parseJsonToObj = str => {
  try {
    return JSON.parse(str)
  } catch(err) {
    return {}
  }
}

// stringify :: { a } -> String
const stringify = data => {
  try {
    return JSON.stringify(data)
  } catch(err) {
    return false
  }
}

/*
 *
 * Others
 */

// createRandomString :: Int -> String
const createRandomString = len => {
  if(isType('number')(len)) {
    const source = 'abcdefghijklmnoprstuvwqxyz0123456789'
    let str = ''

    for(let i = 1; i <= len; i++) {
      var randChar = source.charAt(Math.floor(Math.random() * source.length))

      str += randChar
    }

    return str
  }

  return false
}

module.exports = {
  All, Maybe, First, Last, Reader, Async,
  assoc, chain, compose, composePreds, contains, constant, createRandomString, curry2, curry3,
  hasMinLen, identity, ifElse,
  isArray, isType, isTrue, isFalse, isNil, isNotNil, flip, log,
  map, mapProps, mapObj, match, maybeToAsync, mconcat, mconcatMap, mreduceMap, not, objOf, omit, parseJsonToObj, pick, pmatch, prop, replace,
  safeIs, safeProp, stringify, tap, tagValue, trim
}
