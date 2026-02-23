import url from 'node:url'

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const delay = Number.parseInt(parsed.query.delay || '1500', 10)

  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: { ts: Date.now(), delay }, message: 'ok' }))
  }, delay)
}
