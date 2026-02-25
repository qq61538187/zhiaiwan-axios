import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const projectRoot = resolve(__dirname, '..')
const port = Number(process.argv[2] || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function getExampleDirs() {
  return readdirSync(__dirname).filter((name) => {
    const full = join(__dirname, name)
    if (!statSync(full).isDirectory()) return false
    return existsSync(join(full, 'index.html'))
  })
}

function indexHtml(dirs) {
  const sorted = [...dirs].sort((a, b) => a.localeCompare(b))
  const links = sorted
    .map(
      (dir) =>
        `<li><a href="/${dir}/" aria-label="打开示例 ${dir}"><span class="demo-name">${dir}</span><span class="demo-meta">交互示例</span></a></li>`,
    )
    .join('')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>@zhiaiwan/axios examples</title>
  <link rel="stylesheet" href="/shared.css" />
  <style>
    .index-subtitle { color: #64748b; font-size: 14px; margin-top: 8px; line-height: 1.65; max-width: 72ch; }
    .index-grid { display: grid; gap: 14px; }
    .index-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .index-list li a { text-decoration: none; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; transition: border-color 180ms ease, box-shadow 180ms ease; }
    .index-list li a:hover { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.08); }
    .index-list li a:focus-visible { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,.2); }
    .demo-name { font-weight: 600; color: #0f172a; }
    .demo-meta { font-size: 12px; color: #64748b; }
    .index-hint { margin-top: 6px; font-size: 12px; color: #64748b; }
    .cmd { display: inline-block; margin-top: 8px; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: "SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-header">
      <h1>@zhiaiwan/axios 示例中心</h1>
      <p class="index-subtitle">快速查看全部能力示例，默认仅提供中文文案展示。</p>
    </div>
    <div class="index-grid">
      <div class="card">
        <h3>快速开始</h3>
        <p>运行前先构建产物：</p>
        <span class="cmd">pnpm build</span>
        <span class="cmd">pnpm examples</span>
        <p class="index-hint">端口占用时可使用：<code>pnpm examples -- 3001</code></p>
      </div>
      <div class="card">
        <h3>可用示例（${sorted.length}）</h3>
        <p>点击任意示例进入交互页面。</p>
        <ul class="index-list">${links}</ul>
      </div>
    </div>
  </div>
</body>
</html>`
}

function safeResolve(base, reqPath) {
  const cleaned = normalize(reqPath).replace(/^(\.\.[/\\])+/, '')
  return resolve(base, `.${cleaned.startsWith('/') ? cleaned : `/${cleaned}`}`)
}

function serveFile(res, filePath) {
  const ext = extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'
  if (ext === '.html') {
    const html = readFileSync(filePath, 'utf-8')
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(html)
    return
  }
  const buf = readFileSync(filePath)
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(buf)
}

const server = createServer(async (req, res) => {
  const reqUrl = req.url || '/'

  if (reqUrl === '/' || reqUrl === '/index.html') {
    const html = indexHtml(getExampleDirs())
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (reqUrl === '/favicon.ico') {
    res.writeHead(204, { 'Content-Type': 'image/x-icon' })
    res.end()
    return
  }

  // /<example>/server -> dynamic import examples/<example>/server.js
  const match = reqUrl.match(/^\/([^/]+)\/server(?:\?.*)?$/)
  if (match) {
    const exampleName = match[1]
    const handlerFile = join(__dirname, exampleName, 'server.js')
    if (!existsSync(handlerFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ code: 404, data: null, message: 'Example server not found' }))
      return
    }
    const mod = await import(pathToFileURL(handlerFile).href)
    await mod.default(req, res)
    return
  }

  const localPath = reqUrl.endsWith('/') ? `${reqUrl}index.html` : reqUrl

  // static: prefer examples/, fallback to project root (dist/node_modules)
  const fileInExamples = safeResolve(__dirname, localPath)
  if (
    fileInExamples.startsWith(__dirname) &&
    existsSync(fileInExamples) &&
    statSync(fileInExamples).isFile()
  ) {
    serveFile(res, fileInExamples)
    return
  }

  const fileInProject = safeResolve(projectRoot, localPath)
  if (
    fileInProject.startsWith(projectRoot) &&
    existsSync(fileInProject) &&
    statSync(fileInProject).isFile()
  ) {
    serveFile(res, fileInProject)
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not Found')
})

server.listen(port, () => {
  // biome-ignore lint/suspicious/noConsole: examples server startup log
  console.log(`\n  @zhiaiwan/axios examples running at http://localhost:${port}\n`)
})
