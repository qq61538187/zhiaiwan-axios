export default function (req, res) {
  const start = Date.now()

  setTimeout(() => {
    const duration = Date.now() - start
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Response-Time': `${duration}ms`,
    })
    res.end(
      JSON.stringify({
        code: 0,
        data: {
          timestamp: Date.now(),
          headers: req.headers,
        },
        message: 'ok',
      }),
    )
  }, 200)
}
