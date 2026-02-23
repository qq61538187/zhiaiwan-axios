import url from 'node:url'

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const scenario = parsed.query.scenario || 'success'
  res.setHeader('Content-Type', 'application/json')

  switch (scenario) {
    case 'success':
      res.writeHead(200)
      res.end(JSON.stringify({ code: 0, data: { ok: true }, message: 'ok' }))
      break

    case 'business':
      res.writeHead(200)
      res.end(JSON.stringify({ code: 40001, data: null, message: '参数校验失败' }))
      break

    case 'http':
      res.writeHead(500)
      res.end(JSON.stringify({ error: 'Internal Server Error' }))
      break

    case 'timeout':
      // Never respond — let the client timeout
      break

    default:
      res.writeHead(200)
      res.end(JSON.stringify({ code: 0, data: null, message: 'unknown scenario' }))
  }
}
