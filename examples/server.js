import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')

const PORT = process.argv[2] || 3000
const LANG_STORAGE_KEY = 'zhiaiwan-examples-lang'

const I18N_CSS = `
<style id="example-i18n-style">
.lang-switcher{
  position:fixed;
  top:12px;
  right:12px;
  z-index:1000;
  display:inline-flex;
  gap:6px;
  padding:4px;
  border:1px solid #e2e8f0;
  border-radius:999px;
  background:#ffffffd9;
  backdrop-filter:saturate(180%) blur(6px);
}
.lang-switcher button{
  border:none;
  border-radius:999px;
  height:30px;
  padding:0 12px;
  font-size:12px;
  font-weight:600;
  cursor:pointer;
  color:#334155;
  background:transparent;
}
.lang-switcher button.active{
  background:#4f46e5;
  color:#fff;
}
@media (max-width:640px){
  .lang-switcher{ top:10px; right:10px; }
  .lang-switcher button{ height:32px; min-width:56px; }
}
</style>
`

const I18N_SCRIPT = `
<script id="example-i18n-script">
(() => {
  const STORAGE_KEY = '${LANG_STORAGE_KEY}'
  const BASE_PHRASES = [
    ['中文', 'Chinese'],
    ['请求', 'Request'],
    ['响应', 'Response'],
    ['成功', 'Success'],
    ['失败', 'Failed'],
    ['错误', 'Error'],
    ['业务错误', 'Business Error'],
    ['超时', 'Timeout'],
    ['日志', 'Logs'],
    ['结果', 'Result'],
    ['发起', 'Start'],
    ['加载中...', 'Loading...'],
    ['请求中...', 'Requesting...'],
    ['全部请求完成', 'All requests completed'],
    ['清空', 'Clear'],
    ['获取', 'Get'],
    ['重试', 'Retry'],
    ['取消', 'Cancel'],
    ['缓存', 'Cache'],
    ['并发', 'Concurrent'],
    ['慢请求', 'Slow Request'],
    ['队列', 'Queue'],
    ['命中缓存', 'Cache Hit'],
    ['下载完成', 'Download completed'],
    ['下载失败', 'Download failed'],
    ['下载中...', 'Downloading...'],
    ['等待下载...', 'Waiting for download...'],
    ['开始下载', 'Start downloading'],
    ['上传', 'Upload'],
    ['请选择文件', 'Please choose a file'],
    ['选择文件', 'Choose file'],
    ['文件描述', 'File description'],
    ['添加动态拦截器', 'Add dynamic interceptor'],
    ['移除动态拦截器', 'Remove dynamic interceptor'],
    ['发送请求', 'Send request'],
    ['正常请求', 'Normal request'],
    ['慢请求', 'Slow request'],
    ['失败请求', 'Failed request'],
    ['同时发起', 'Start together'],
    ['实例', 'Instance'],
    ['状态', 'Status'],
    ['在途', 'In-flight'],
    ['下载文件', 'Download file'],
    ['获取全部', 'Get all'],
    ['查询', 'Query'],
    ['删除用户', 'Delete user'],
    ['创建用户', 'Create user'],
    ['默认解包', 'Default transform'],
    ['自定义 transform', 'Custom transform'],
    ['禁用重试', 'Disable retry'],
    ['全局 retry', 'Global retry'],
    ['覆盖', 'Override'],
    ['拦截器日志', 'Interceptor logs'],
    ['响应结果', 'Response result'],
    ['实时日志', 'Realtime logs'],
    ['触发次数', 'Trigger count'],
    ['发起请求', 'Start request'],
    ['快请求', 'Fast request'],
    ['中等', 'Medium'],
    ['很慢', 'Very slow'],
    ['请耐心等待', 'please wait'],
    ['网络不可用', 'Network unavailable'],
    ['登录已过期，请重新登录', 'Session expired, please login again'],
    ['缓存已清除', 'Cache cleared'],
    ['真实项目完整配置', 'Production-like full config'],
    ['操作面板', 'Action panel'],
    ['获取用户列表', 'Get user list'],
    ['再次获取', 'Get again'],
    ['不稳定接口', 'Flaky endpoint'],
    ['使 Token 过期', 'Expire token'],
    ['清除缓存', 'Clear cache'],
    ['去重', 'Deduplicate'],
    ['分组取消', 'Cancel by group'],
    ['按 ID 取消', 'Cancel by ID'],
    ['取消全部', 'Cancel all'],
    ['取消中断重试', 'Cancel to interrupt retry'],
    ['全屏', 'Fullscreen'],
    ['局部', 'Partial'],
    ['状态监听', 'State watcher'],
    ['调用方结果', 'Caller result'],
  ]

  const normalize = (text) => text.replace(/\\s+/g, ' ').trim()
  const zhToEn = BASE_PHRASES.sort((a, b) => b[0].length - a[0].length)
  const enToZh = BASE_PHRASES.map(([zh, en]) => [en, zh]).sort((a, b) => b[0].length - a[0].length)

  const replaceByLang = (value, lang) => {
    if (!value) return value
    let next = String(value)
    const pairs = lang === 'en' ? zhToEn : enToZh
    for (const [from, to] of pairs) {
      if (!from) continue
      next = next.split(from).join(to)
    }
    return next
  }

  const shouldSkipNode = (node) => {
    const p = node.parentElement
    if (!p) return true
    const tag = p.tagName
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE'
  }

  const walkTextNodes = (root, callback) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const list = []
    while (walker.nextNode()) list.push(walker.currentNode)
    for (const node of list) callback(node)
  }

  const syncAttributes = (lang) => {
    const attrs = ['placeholder', 'title', 'aria-label']
    const nodes = document.querySelectorAll('*')
    for (const el of nodes) {
      for (const attr of attrs) {
        const raw = el.getAttribute(attr)
        if (!raw) continue
        const baseKey = 'data-i18n-base-' + attr
        if (!el.getAttribute(baseKey)) el.setAttribute(baseKey, raw)
        const base = el.getAttribute(baseKey) || raw
        el.setAttribute(attr, replaceByLang(base, lang))
      }
    }
  }

  const applyLang = (lang) => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
    walkTextNodes(document.body, (node) => {
      if (shouldSkipNode(node)) return
      const original = node.__i18nBase || normalize(node.nodeValue || '')
      if (!original) return
      if (!node.__i18nBase) node.__i18nBase = original
      node.nodeValue = replaceByLang(original, lang)
    })
    syncAttributes(lang)
    const zhBtn = document.getElementById('lang-zh')
    const enBtn = document.getElementById('lang-en')
    if (zhBtn && enBtn) {
      zhBtn.classList.toggle('active', lang === 'zh')
      enBtn.classList.toggle('active', lang === 'en')
    }
    localStorage.setItem(STORAGE_KEY, lang)
  }

  const mountSwitcher = () => {
    if (document.getElementById('lang-switcher')) return
    const box = document.createElement('div')
    box.id = 'lang-switcher'
    box.className = 'lang-switcher'
    box.innerHTML = '<button id="lang-zh" type="button">中文</button><button id="lang-en" type="button">EN</button>'
    document.body.appendChild(box)
    document.getElementById('lang-zh')?.addEventListener('click', () => applyLang('zh'))
    document.getElementById('lang-en')?.addEventListener('click', () => applyLang('en'))
  }

  const init = () => {
    mountSwitcher()
    const lang = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
    applyLang(lang)
    const observer = new MutationObserver(() => applyLang(localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
</script>
`

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

function injectI18N(html) {
  if (!html.includes('</head>') || !html.includes('</body>')) return html
  const withStyle = html.replace('</head>', `${I18N_CSS}\n</head>`)
  return withStyle.replace('</body>', `${I18N_SCRIPT}\n</body>`)
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
  if (ext === '.html') {
    const html = fs.readFileSync(resolved, 'utf-8')
    send(res, 200, injectI18N(html), contentType)
    return
  }
  res.writeHead(200, { 'Content-Type': contentType })
  fs.createReadStream(resolved).pipe(res)
}

const dirs = listDirs(__dirname)
const serverModules = new Map()

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url.split('?')[0]

  if (reqUrl === '/favicon.ico') {
    send(res, 204, '')
    return
  }

  // Root index
  if (reqUrl === '/' || reqUrl === '/index.html') {
    send(res, 200, injectI18N(getIndexTemplate(dirs)))
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
