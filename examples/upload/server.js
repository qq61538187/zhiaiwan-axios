export default function (req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 405, data: null, message: 'Method Not Allowed' }))
    return
  }

  let size = 0
  const chunks = []

  req.on('data', (chunk) => {
    size += chunk.length
    chunks.push(chunk)
  })

  req.on('end', () => {
    // Simulate processing delay so the progress bar is visible on fast connections
    setTimeout(() => {
      console.log(`[upload] Received ${size} bytes`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          code: 0,
          data: {
            size,
            filename: `uploaded-${Date.now()}.bin`,
            url: `/files/uploaded-${Date.now()}.bin`,
          },
          message: 'uploaded',
        }),
      )
    }, 300)
  })
}
