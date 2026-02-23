import url from 'node:url'

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const delay = Number.parseInt(parsed.query.delay || '500', 10)

  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: { delay, ts: Date.now() }, message: 'ok' }))
  }, delay)
}
