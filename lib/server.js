const http = require('http')
const https = require('https')
const url = require('url')
const StringDecoder = require('string_decoder').StringDecoder

const { Reader, Maybe,
  assoc, compose, chain,
  isType, isNotNil, flip, log, map, objOf,
  parseJsonToObj, safeProp, replace, safeIs, stringify, tap
} = require('../helpers')

const { safe, option } = Maybe

/*
 *
 * Request metadata extraction
 */

// getTrimmedPath :: Req -> String
const getTrimmedPath =
  compose(
    option(''),
    map(replace(/^\/+|\/+$/g, '')),
    chain(safeProp('pathname')),
    map(flip(url.parse)(true)),
    safeProp('url')
  )

// getQueryParams :: Req -> {}
const getQueryParams =
  compose(
    option({}),
    chain(safeProp('query')),
    map(flip(url.parse)(true)),
    safeProp('url')
  )

// getMethod :: Req -> String
const getMethod =
  compose(
    option(''),
    map(s => s.toLowerCase()),
    safeProp('method')
  )

// getHeaders :: Req -> {}
const getHeaders = 
  compose(
    option({}),
    safeProp('headers')
  )

// read :: (String, (Req -> a)) -> {} -> Reader Req {}
const read = (key, extractor) => data =>
  Reader(
    compose(
      assoc(data),
      objOf(key),
      extractor
    )
  )

// flow :: Req -> Reader Req {}
const flow =
  read('path', getTrimmedPath)({})
    .chain(read('method', getMethod))
    .chain(read('params', getQueryParams))
    .chain(read('headers', getHeaders))

/*
 *
 * Response preparation
 */

// safePayload :: {} -> String
const safePayload =
  compose(
    stringify,
    safeIs(isType('object'))({})
  )

// safeCode :: Number -> Number
const safeCode = safeIs(isType('number'))(200)

/*
 *
 * Routing
 */

// safeNotFound :: Router -> Handler
const safeNotFound =
  router =>
    safe(isNotNil)(router['notFound']).option((data, cb) => cb(404))

// getRoute :: Router -> Maybe Handler
const getRoute =
  router => data => 
    safe(isNotNil)(data.path)
      .chain(path => safe(isNotNil)(router[path]))

/*
 *
 * Effects
 */

// handleResponse :: Res -> (Number, {}) -> [ Number, {} ]
const handleResponse = (res, { path, method }) => (code, payload) => {
  res.setHeader('Content-type', 'application/json')
  res.writeHead(safeCode(code))
  res.end(safePayload(payload))

  log(`${method} ${path} - ${safeCode(code)} ${safePayload(payload)}`)

  return [ code, payload ]
}

// handleRequest :: (Router :: {}) -> (Req, Res) -> ()
const handleRequest = router => (req, res) => {
  const decoder = new StringDecoder('utf-8')
  let buffer = ''

  req.on('data', data => buffer += decoder.write(data))
  req.on('end', () => {
    buffer += decoder.end()

    const parsed =
      flow
        .map(assoc({ payload: parseJsonToObj(buffer) }))
        .runWith(req)

    const selectedRouter =
      getRoute(router)(parsed)
        .option(safeNotFound(router))

    selectedRouter(parsed, handleResponse(res, { 
      path: parsed.path,
      method: parsed.method
    }))
  })

  return ('Executing request...')
}


module.exports = {
  httpsServer: (options, router) => https.createServer(
    options,
    compose(
      tap(log),
      handleRequest(router)
    )
  ),
  httpServer: (router) => http.createServer(
    compose(
      tap(log),
      handleRequest(router)
    )
  )
}

