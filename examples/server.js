import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')

const PORT = process.argv[2] || 3000

function listDirs(root) {
  return fs
    .readdirSync(root)
    .filter((f) => f[0] !== '.' && fs.statSync(path.join(root, f)).isDirectory())
}

function getIndexTemplate(dirs) {
  const links = dirs.map((dir) => `<li><a href="/${dir}">${dir}</a></li>`).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <title>@zhiaiwan/axios examples</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b;-webkit-font-smoothing:antialiased}
    .page{max-width:520px;margin:0 auto;padding:48px 24px}
    h1{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .sub{font-size:13px;color:#64748b;margin-bottom:28px}
    ul{list-style:none}
    li{margin:4px 0}
    li a{display:flex;align-items:center;padding:12px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#1e293b;font-size:14px;font-weight:500;transition:border-color .2s,box-shadow .2s;cursor:pointer}
    li a:hover{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.08)}
    li a::after{content:'→';margin-left:auto;color:#94a3b8;font-weight:400}
    li a:hover::after{color:#4f46e5}
  </style>
</head>
<body>
  <div class="page">
    <h1>@zhiaiwan/axios</h1>
    <p class="sub">Interactive examples for every feature</p>
    <ul>${links}</ul>
  </div>
</body>
</html>`
}

function send(res, statusCode, body, contentType = 'text/html') {
  res.writeHead(statusCode, { 'Content-Type': contentType })
  res.end(body)
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
}

function serveStatic(res, filePath) {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(PROJECT_ROOT) || !fs.existsSync(resolved)) {
    send(res, 404, 'Not Found')
    return
  }
  const ext = path.extname(resolved)
  const contentType = MIME[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType })
  fs.createReadStream(resolved).pipe(res)
}

const dirs = listDirs(__dirname)
const serverModules = new Map()

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url.split('?')[0]

  // Root index
  if (reqUrl === '/' || reqUrl === '/index.html') {
    send(res, 200, getIndexTemplate(dirs))
    return
  }

  // Normalize: /basic -> /basic/index.html
  let normalized = reqUrl
  if (dirs.includes(reqUrl.replace(/^\//, '').replace(/\/$/, ''))) {
    normalized = reqUrl.replace(/\/?$/, '/index.html')
  }

  // Route /<dir>/server to the example's server.js handler
  const serverMatch = normalized.match(/^\/([^/]+)\/server$/)
  if (serverMatch && dirs.includes(serverMatch[1])) {
    const serverFile = path.join(__dirname, serverMatch[1], 'server.js')
    if (fs.existsSync(serverFile)) {
      try {
        if (!serverModules.has(serverFile)) {
          serverModules.set(serverFile, await import(`file://${serverFile}`))
        }
        serverModules.get(serverFile).default(req, res)
      } catch (err) {
        console.error('Error loading server:', err)
        send(res, 500, 'Server error')
      }
    } else {
      send(res, 404, 'No server.js')
    }
    return
  }

  // Serve static files — try examples/ first, then project root (for dist/, node_modules/)
  const localPath = path.join(__dirname, normalized)
  if (fs.existsSync(localPath)) {
    serveStatic(res, localPath)
  } else {
    serveStatic(res, path.join(PROJECT_ROOT, normalized))
  }
})

server.listen(PORT, () => {
  console.log(`\n  @zhiaiwan/axios examples running at http://localhost:${PORT}\n`)
})
