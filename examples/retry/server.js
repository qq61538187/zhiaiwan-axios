let callCount = 0

export default function (req, res) {
  callCount++
  res.setHeader('Content-Type', 'application/json')

  // First 2 requests return 500, third succeeds
  if (callCount % 3 !== 0) {
    console.log(`[retry] Request #${callCount} → 500`)
    res.writeHead(500)
    res.end(JSON.stringify({ code: 500, data: null, message: 'Internal Server Error' }))
    return
  }

  console.log(`[retry] Request #${callCount} → 200 (success)`)
  res.writeHead(200)
  res.end(
    JSON.stringify({
      code: 0,
      data: { attempt: callCount, timestamp: Date.now() },
      message: 'ok',
    }),
  )
}
