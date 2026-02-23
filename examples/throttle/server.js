import url from 'node:url'

let counter = 0

export default function (req, res) {
  counter++
  const id = counter
  const parsed = url.parse(req.url, true)
  const delay = Number.parseInt(parsed.query.delay) || 1000

  console.log(`[throttle] #${id} start (delay=${delay}ms)`)

  setTimeout(() => {
    console.log(`[throttle] #${id} done`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        code: 0,
        data: { id, delay, timestamp: Date.now() },
        message: 'ok',
      }),
    )
  }, delay)
}
