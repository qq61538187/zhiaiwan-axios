import url from 'node:url'

let nextId = 4
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
]

function json(res, code, data, message = 'ok', status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ code, data, message }))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => {
      body += c
    })
    req.on('end', () => resolve(body ? JSON.parse(body) : {}))
  })
}

export default async function (req, res) {
  const parsed = url.parse(req.url, true)
  const query = parsed.query

  // Echo back any custom request headers starting with x-
  const echoHeaders = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.startsWith('x-')) echoHeaders[k] = v
  }

  if (req.method === 'GET') {
    // Single user: ?id=N
    if (query.id) {
      const user = users.find((u) => u.id === Number(query.id))
      if (!user) return json(res, 404, null, 'User not found', 200)
      return json(res, 0, { ...user, _echoHeaders: echoHeaders })
    }
    // Paginated list: ?page=1&size=2&search=xxx
    const page = Math.max(1, Number.parseInt(query.page) || 1)
    const size = Math.max(1, Number.parseInt(query.size) || 10)
    let filtered = users
    if (query.search) {
      const q = query.search.toLowerCase()
      filtered = users.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    }
    const start = (page - 1) * size
    const items = filtered.slice(start, start + size)
    return json(res, 0, { items, total: filtered.length, page, size })
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    const user = { id: nextId++, ...body }
    users.push(user)
    return json(res, 0, user, 'created')
  }

  if (req.method === 'PUT') {
    const body = await readBody(req)
    const idx = users.findIndex((u) => u.id === Number(body.id))
    if (idx === -1) return json(res, 404, null, 'User not found')
    users[idx] = { ...body, id: users[idx].id }
    return json(res, 0, users[idx], 'updated')
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const idx = users.findIndex((u) => u.id === Number(body.id))
    if (idx === -1) return json(res, 404, null, 'User not found')
    Object.assign(users[idx], body, { id: users[idx].id })
    return json(res, 0, users[idx], 'patched')
  }

  if (req.method === 'DELETE') {
    const id = Number(query.id)
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) return json(res, 404, null, 'User not found')
    const [removed] = users.splice(idx, 1)
    return json(res, 0, removed, 'deleted')
  }

  json(res, 405, null, 'Method Not Allowed', 405)
}
