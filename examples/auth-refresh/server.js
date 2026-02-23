import url from 'node:url'

let validToken = 'token-001'
let refreshCount = 0

export default function (req, res) {
  const parsed = url.parse(req.url, true)
  res.setHeader('Content-Type', 'application/json')

  // Refresh endpoint
  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      refreshCount++
      validToken = `token-${String(refreshCount + 1).padStart(3, '0')}`
      console.log('[auth] Token refreshed to:', validToken)
      res.writeHead(200)
      res.end(JSON.stringify({ code: 0, data: validToken, message: 'refreshed' }))
    })
    return
  }

  // Protected endpoint — check Authorization header
  const auth = req.headers.authorization
  if (auth !== `Bearer ${validToken}`) {
    console.log('[auth] 401 — got:', auth, ', expected: Bearer', validToken)
    res.writeHead(401)
    res.end(JSON.stringify({ code: 401, data: null, message: 'Unauthorized' }))
    return
  }

  res.writeHead(200)
  res.end(
    JSON.stringify({
      code: 0,
      data: { name: 'Alice', token: validToken },
      message: 'ok',
    }),
  )
}
