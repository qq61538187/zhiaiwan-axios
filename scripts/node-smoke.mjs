import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cjsEntry = require('../dist/index.cjs')
const esmEntry = await import(new URL('../dist/index.js', import.meta.url))

function makeAdapter() {
  return async (config) => ({
    data: { code: 0, data: 'ok', message: '' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}

async function runSmoke(source, label) {
  if (typeof source.createAxios !== 'function') {
    throw new Error(`${label}: createAxios export missing`)
  }
  const http = source.createAxios({
    adapter: makeAdapter(),
    successCode: [0],
  })
  const res = await http.get('/node-smoke')
  if (res.data !== 'ok') {
    throw new Error(`${label}: unexpected payload`)
  }
}

await runSmoke(cjsEntry, 'cjs')
await runSmoke(esmEntry, 'esm')

console.log('node smoke passed (cjs + esm)')
