import url from 'node:url'

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const scenario = parsed.query.scenario || 'ok'

  res.setHeader('Content-Type', 'application/json')

  switch (scenario) {
    case 'ok':
      res.writeHead(200)
      res.end(JSON.stringify({ code: 0, data: { ok: true }, message: 'ok' }))
      break

    case 'business':
      res.writeHead(200)
      res.end(JSON.stringify({ code: 40001, data: null, message: 'business failed' }))
      break

    case 'http':
      res.writeHead(503)
      res.end(JSON.stringify({ error: 'Service Unavailable' }))
      break

    case 'timeout':
      // Keep connection open to trigger client timeout.
      break

    default:
      res.writeHead(200)
      res.end(JSON.stringify({ code: 0, data: null, message: 'unknown scenario' }))
  }
}
