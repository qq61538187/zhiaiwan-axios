import url from 'node:url'

let callCount = 0

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const delay = Number.parseInt(parsed.query.delay) || 2000
  const fail = parsed.query.fail === '1'

  callCount++
  const n = callCount

  const timer = setTimeout(() => {
    if (fail) {
      console.log(`[cancel] #${n} → 500`)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, data: null, message: `Error #${n}` }))
      return
    }
    console.log(`[cancel] #${n} → 200`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        code: 0,
        data: { message: `Response after ${delay}ms`, call: n, timestamp: Date.now() },
        message: 'ok',
      }),
    )
  }, delay)

  req.on('close', () => clearTimeout(timer))
}
