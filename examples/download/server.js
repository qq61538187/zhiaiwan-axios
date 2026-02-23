const TOTAL = 512 * 1024 // 512 KB
const CHUNK = 16 * 1024
const INTERVAL = 80 // ms between chunks — slow enough to see progress

export default function (req, res) {
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="demo-file.bin"',
      'Content-Length': TOTAL,
    })

    let sent = 0
    const timer = setInterval(() => {
      const remaining = TOTAL - sent
      const size = Math.min(CHUNK, remaining)
      res.write(Buffer.alloc(size, 0x41))
      sent += size
      if (sent >= TOTAL) {
        clearInterval(timer)
        res.end()
      }
    }, INTERVAL)

    req.on('close', () => clearInterval(timer))
    return
  }

  res.writeHead(405, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ code: 405, data: null, message: 'Method Not Allowed' }))
}
