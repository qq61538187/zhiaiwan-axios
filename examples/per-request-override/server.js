import url from 'node:url'

let callCount = 0

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  const action = parsed.query.action || 'normal'

  callCount++

  // Simulate different business code formats
  if (action === 'legacy') {
    // Legacy API returns code=200 for success instead of 0
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 200, data: { source: 'legacy-api', callCount }, message: 'ok' }))
    return
  }

  if (action === 'fail-then-ok') {
    // First 2 calls fail with 500, then succeed
    if (callCount % 3 !== 0) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 500, data: null, message: `Fail #${callCount}` }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: { callCount, retried: true }, message: 'ok' }))
    return
  }

  if (action === 'raw') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Request-Id': `req-${Date.now()}`,
      'X-Rate-Limit-Remaining': '42',
    })
    res.end(JSON.stringify({ code: 0, data: { callCount }, message: 'ok' }))
    return
  }

  // Normal
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ code: 0, data: { action, callCount }, message: 'ok' }))
}
