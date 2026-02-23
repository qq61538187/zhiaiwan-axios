import url from 'node:url'

let validToken = 'token-001'
let refreshCount = 0
let callCount = 0

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const action = parsed.query.action

  // Token refresh
  if (req.method === 'POST' && action === 'refresh') {
    refreshCount++
    validToken = `token-${String(refreshCount + 1).padStart(3, '0')}`
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: validToken, message: 'refreshed' }))
    return
  }

  // Check auth
  const auth = req.headers.authorization
  if (auth && auth !== `Bearer ${validToken}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 401, data: null, message: 'Unauthorized' }))
    return
  }

  callCount++

  // Normal data endpoint (with optional delay)
  const delay = Number.parseInt(parsed.query.delay || '0', 10)

  // Simulate intermittent failure
  if (action === 'flaky' && callCount % 3 !== 0) {
    setTimeout(() => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, data: null, message: `Flaky error #${callCount}` }))
    }, delay)
    return
  }

  // User list
  if (action === 'users') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          code: 0,
          data: [
            { id: 1, name: 'Alice', role: 'admin' },
            { id: 2, name: 'Bob', role: 'user' },
            { id: 3, name: 'Charlie', role: 'user' },
          ],
          message: 'ok',
        }),
      )
    }, delay)
    return
  }

  // Default
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        code: 0,
        data: { callCount, ts: Date.now(), token: validToken },
        message: 'ok',
      }),
    )
  }, delay)
}
