import url from 'node:url'

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const api = parsed.query.api || 'main'
  const delay = Number.parseInt(parsed.query.delay || '0', 10)

  if (api === 'main') {
    const token = req.headers.authorization
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          code: 0,
          data: { source: 'Business API', user: 'Alice', token: token || '(none)' },
          message: 'ok',
        }),
      )
    }, delay)
    return
  }

  if (api === 'third-party') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          results: [
            { city: 'Beijing', temp: '22°C' },
            { city: 'Shanghai', temp: '25°C' },
          ],
        }),
      )
    }, delay || 300)
    return
  }

  if (api === 'fail') {
    setTimeout(() => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, data: null, message: 'Server Error' }))
    }, delay)
    return
  }

  res.writeHead(400, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ code: 400, data: null, message: 'Unknown api type' }))
}
