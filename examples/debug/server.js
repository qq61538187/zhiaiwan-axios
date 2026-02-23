let count = 0

export default function (req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const delay = Number.parseInt(url.searchParams.get('delay') || '0', 10)
  const fail = url.searchParams.get('fail') === '1'

  count++
  const id = count

  setTimeout(() => {
    if (fail) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, data: null, message: `Server error #${id}` }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: { id, ts: Date.now() }, message: 'ok' }))
  }, delay)
}
