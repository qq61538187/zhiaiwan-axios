# @zhiaiwan/axios

[![npm version](https://img.shields.io/npm/v/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![npm downloads](https://img.shields.io/npm/dm/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![CI](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml/badge.svg)](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[中文](./README.md) | **English**

A modern, type-safe HTTP client built on top of axios, providing out-of-the-box request queue tracking, group cancellation, automatic retry, token refresh, error classification, concurrency limiting, response caching, and debug logging.

### Requirements

- Node.js >= 20

## Installation

axios is included as a built-in dependency — no separate installation needed.

```bash
# pnpm
pnpm add @zhiaiwan/axios

# npm
npm install @zhiaiwan/axios

# yarn
yarn add @zhiaiwan/axios
```

## Quick Start

```ts
import { createAxios } from '@zhiaiwan/axios'

const http = createAxios({
  baseURL: '/api',
  timeout: 15000,
})

interface UserInfo {
  id: number
  name: string
}

const { data } = await http.get<UserInfo>('/user/info')
console.log(data.name)
```

### Full Configuration Example

```ts
import { createAxios } from '@zhiaiwan/axios'

const http = createAxios({
  // --- Native axios options ---
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },

  // --- Request deduplication ---
  cancel: {
    deduplicate: true,
    key: 'method-url-params-data',
  },

  // --- Auto retry ---
  retry: {
    count: 3,
    delay: 1000,
    maxDelay: 30000,
    statusCodes: [408, 500, 502, 503, 504],
    methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
    shouldRetry: (error, retryCount) => {
      // Custom retry logic (highest priority)
      return retryCount < 2
    },
  },

  // --- Token management ---
  auth: {
    getToken: () => localStorage.getItem('token'),
    refreshToken: async () => {
      const res = await refreshTokenApi()
      localStorage.setItem('token', res.token)
      return res.token
    },
    headerName: 'Authorization',
    tokenPrefix: 'Bearer',
    onUnauthorized: () => router.push('/login'),
  },

  // --- Business success codes (supports multiple) ---
  successCode: [0, 200],

  // --- Global error hook (with error type classification) ---
  onError: (error, type, config) => {
    // type: 'network' | 'timeout' | 'http' | 'business' | 'cancel' | 'unknown'
    if (type === 'cancel') return
    if (type === 'network') return { code: 0, data: null, message: 'Network unavailable' } // Return fallback data
    message.error(error.message || 'Request failed')
    // Return void: throw normally | false: swallow error | other value: resolve as fallback data
  },

  // --- Request queue & slow request hooks ---
  tracker: {
    onLoadingChange: (loading) => store.setGlobalLoading(loading),
    onQueueChange: (queue) => console.log('Active:', queue.length),
    onRequestStart: (entry) => console.log(`→ ${entry.method} ${entry.url}`),
    onRequestEnd: (entry) => console.log(`← ${entry.url} [${entry.duration}ms]`),
    slowThreshold: 10000,
    onSlowRequest: (entry) => console.warn(`Slow request: ${entry.url} elapsed ${entry.duration}ms`),
  },

  // --- Concurrency limit ---
  throttle: { maxConcurrent: 6 },

  // --- GET response cache ---
  cache: { ttl: 30000, methods: ['GET'] },

  // --- Debug logging ---
  debug: true,
})
```

## API Reference

### `createAxios(options?)`

Factory function that creates a `ZhiAxios` instance.

```ts
const http = createAxios(options?: CreateAxiosOptions): ZhiAxios
```

### Request Methods

All methods return `Promise<ApiResponse<T>>`, where `ApiResponse` has the following structure:

```ts
interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}
```

```ts
http.get<T>(url, config?)
http.post<T>(url, data?, config?)
http.put<T>(url, data?, config?)
http.patch<T>(url, data?, config?)
http.delete<T>(url, config?)
http.request<T>(config)
```

Each request's `config` supports additional fields:

```ts
http.get('/users', {
  requestId: 'fetch-users',      // Custom request ID (auto-generated if omitted)
  requestGroup: 'user-module',   // Request group tag
  successCode: [0, 200],         // Per-request success codes (overrides global)
  responseTransform: false,      // Disable unwrapping for this request (overrides global)
  retry: { count: 5 },           // Per-request retry config (overrides global)
  cache: false,                  // Skip cache read/write for this request
  cacheKey: 'user:list',         // Custom cache key
})
```

### Upload & Download

```ts
// File upload (auto-sets Content-Type: multipart/form-data)
const formData = new FormData()
formData.append('file', file)

await http.upload('/upload', formData, {
  onProgress: ({ loaded, total, percent }) => {
    console.log(`Upload progress: ${percent}%`)
  },
})

// Also supports plain objects — auto-converted to FormData
await http.upload('/upload', { file, name: 'avatar' })

// File download (returns full AxiosResponse<Blob>)
const response = await http.download('/file/export', {
  onProgress: ({ loaded, total, percent }) => {
    console.log(`Download progress: ${percent}%`)
  },
})
const blob = response.data
```

### Request Queue & Loading State

```ts
http.loading // boolean — whether any request is in progress
http.queue   // ReadonlyArray<RequestEntry> — snapshot of active requests
```

`RequestEntry` structure:

```ts
interface RequestEntry {
  id: string         // Request ID
  group?: string     // Group tag
  method: string     // HTTP method
  url: string        // Request URL
  startedAt: number  // Start timestamp
  duration?: number  // Elapsed ms (only available in onRequestEnd)
}
```

### Cancel Requests

```ts
http.cancelById('fetch-users')    // Cancel by ID
http.cancelGroup('user-module')   // Cancel by group
http.cancelAll()                  // Cancel all
```

### Cache Management

```ts
http.clearCache() // Clear all response cache
http.invalidateCache(/^users:/) // Invalidate by key / RegExp / matcher fn; returns removed count
```

### Lifecycle Hooks (TrackerHooks)

Configured via the `tracker` option — all hooks are optional:

| Hook | Trigger | Callback |
|------|---------|----------|
| `onQueueChange` | Request enqueued or dequeued | `(queue: RequestEntry[]) => void` |
| `onLoadingChange` | Loading state changes | `(loading: boolean) => void` |
| `onRequestStart` | New request initiated | `(entry: RequestEntry) => void` |
| `onRequestEnd` | Request completed (includes `duration`) | `(entry: RequestEntry) => void` |
| `onSlowRequest` | Request exceeds `slowThreshold` | `(entry: RequestEntry) => void` |

> `onLoadingChange` only fires when the state actually changes — it won't fire on every request in/out.

### Error Classification

All errors are automatically classified as `ErrorType`:

```ts
import { ErrorType, ZhiAxiosError, classifyError } from '@zhiaiwan/axios'

// ErrorType enum
ErrorType.Network   // No network / DNS failure / connection refused
ErrorType.Timeout   // Request timeout
ErrorType.Http      // HTTP status code error (4xx / 5xx)
ErrorType.Business  // Business code not in successCode
ErrorType.Cancel    // Request was manually cancelled
ErrorType.Unknown   // Unknown error

// ZhiAxiosError includes classification info
try {
  await http.get('/api')
} catch (err) {
  if (err instanceof ZhiAxiosError) {
    console.log(err.type)         // ErrorType
    console.log(err.status)       // HTTP status code
    console.log(err.businessCode) // Business code
    console.log(err.raw)          // Original error
  }
}

// You can also manually classify any error
const type = classifyError(someError) // => ErrorType
```

### Interceptors

#### Option 1: Declare at creation (recommended)

Register via `requestInterceptors` / `responseInterceptors` when creating the instance:

```ts
const http = createAxios({
  baseURL: '/api',
  requestInterceptors: [
    // Shorthand: pass a function directly
    (config) => {
      config.headers['X-Request-Id'] = crypto.randomUUID()
      return config
    },
    // Full form: with error handler
    {
      fulfilled: (config) => {
        config.headers['X-Timestamp'] = String(Date.now())
        return config
      },
      rejected: (error) => Promise.reject(error),
    },
  ],
  responseInterceptors: [
    (response) => {
      console.log('Response:', response.status)
      return response
    },
  ],
})
```

**Execution order:**

- **Request interceptors**: Internal interceptors (auth token injection, cancel dedup, etc.) run first, then user-defined interceptors — you receive a fully prepared config
- **Response interceptors**: User-defined interceptors run first (receive raw HTTP response), then internal interceptors (retry, transform, business code validation) process afterward

#### Option 2: Register at runtime

Dynamically register via `onRequest` / `onResponse` methods — returns an unsubscribe function:

```ts
const dispose = http.onRequest((config) => {
  config.headers['X-Request-Id'] = crypto.randomUUID()
  return config
})

const dispose2 = http.onResponse((response) => {
  console.log('Response:', response.status)
  return response
})

// Unsubscribe
dispose()
dispose2()
```

### Access Underlying axios Instance

```ts
http.axios.defaults.headers.common['X-App'] = 'my-app'
```

## Configuration Table (CreateAxiosOptions)

| Property | Type | Default | Description | Since | Deprecated | Replacement |
|----------|------|---------|-------------|-------|------------|-------------|
| `baseURL` | `string` | — | Base request URL | `1.1.0` | No | - |
| `timeout` | `number` | — | Timeout in ms | `1.1.0` | No | - |
| `headers` | `object` | — | Default request headers | `1.1.0` | No | - |
| `requestInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | Custom request interceptors (registered at creation) | `1.1.0` | No | - |
| `responseInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | Custom response interceptors (registered at creation) | `1.1.0` | No | - |
| `cancel.deduplicate` | `boolean` | `false` | Auto-cancel duplicate requests | `1.1.0` | No | - |
| `cancel.key` | `'method-url' \| 'method-url-params-data' \| ((config)=>string)` | `'method-url'` | Deduplication key strategy | `1.1.0` | No | - |
| `retry.count` | `number` | `0` | Max retry attempts | `1.1.0` | No | - |
| `retry.delay` | `number` | `1000` | Initial retry delay (ms) | `1.1.0` | No | - |
| `retry.statusCodes` | `number[]` | `[408,500,502,503,504]` | Status codes that trigger retry | `1.1.0` | No | - |
| `retry.maxDelay` | `number` | `30000` | Max retry delay (ms), caps exponential backoff | `1.1.0` | No | - |
| `retry.methods` | `string[]` | `['GET','HEAD','OPTIONS','PUT','DELETE']` | Methods allowed to retry | `1.1.0` | No | - |
| `retry.shouldRetry` | `(error, count) => boolean` | — | Custom retry predicate | `1.1.0` | No | - |
| `auth.getToken` | `() => string \| null \| Promise<...>` | — | Get current token | `1.1.0` | No | - |
| `auth.refreshToken` | `() => Promise<string>` | — | Refresh token | `1.1.0` | No | - |
| `auth.headerName` | `string` | `'Authorization'` | Token header name | `1.1.0` | No | - |
| `auth.tokenPrefix` | `string` | `'Bearer'` | Token prefix | `1.1.0` | No | - |
| `auth.onUnauthorized` | `() => void` | — | Callback when refresh fails | `1.1.0` | No | - |
| `successCode` | `number \| number[]` | `[0]` | Business success codes | `1.1.0` | No | - |
| `onError` | `(error, type, config?) => void \| false \| T` | — | Global error hook: `void` throws normally, `false` swallows, other values resolve as fallback data | `1.1.0` | No | - |
| `responseTransform` | `false \| (res) => unknown` | Unwraps `response.data` | Response transformation | `1.1.0` | No | - |
| `tracker.onQueueChange` | `(queue) => void` | — | Queue change callback | `1.1.0` | No | - |
| `tracker.onLoadingChange` | `(loading) => void` | — | Loading state change callback | `1.1.0` | No | - |
| `tracker.onRequestStart` | `(entry) => void` | — | Request start callback | `1.1.0` | No | - |
| `tracker.onRequestEnd` | `(entry) => void` | — | Request end callback (includes duration) | `1.1.0` | No | - |
| `tracker.slowThreshold` | `number` | `0` (disabled) | Slow request threshold (ms) | `1.1.0` | No | - |
| `tracker.onSlowRequest` | `(entry) => void` | — | Slow request callback | `1.1.0` | No | - |
| `throttle.maxConcurrent` | `number` | `Infinity` | Max concurrent requests | `1.1.0` | No | - |
| `cache.ttl` | `number` | `0` (disabled) | Cache TTL (ms), in-memory cache | `1.1.0` | No | - |
| `cache.methods` | `string[]` | `['GET']` | Methods to cache | `1.1.0` | No | - |
| `debug` | `boolean \| (msg, ...args) => void` | `false` | Debug logging | `1.1.0` | No | - |

> All native [AxiosRequestConfig](https://axios-http.com/docs/req_config) properties are also accepted.

### Per-request Extra Fields

| Field | Type | Description | Since | Deprecated | Replacement |
|-------|------|-------------|-------|------------|-------------|
| `requestId` | `string` | Custom request ID | `1.1.0` | No | - |
| `requestGroup` | `string` | Request group tag | `1.1.0` | No | - |
| `successCode` | `number \| number[]` | Override global success codes | `1.1.0` | No | - |
| `responseTransform` | `false \| (res) => unknown` | Override global response transform | `1.1.0` | No | - |
| `retry` | `RetryOptions \| false` | Override global retry config, `false` to disable | `1.1.0` | No | - |
| `cache` | `boolean` | Set `false` to skip cache read/write for this request | `1.1.0` | No | - |
| `cacheKey` | `string` | Override the default cache key | `1.1.0` | No | - |

All methods (`get`/`post`/`put`/`patch`/`delete`/`request`/`upload`/`download`) accept `RequestOptions` type with full support for the above extra fields — no `as any` needed:

```ts
// Pass extra fields directly — fully type-safe
http.get('/api/user', {
  requestId: 'fetch-user',
  requestGroup: 'user',
  successCode: [0, 200],
  retry: { count: 5 },
})

// Header merge strategy: creation-time headers are defaults, request-time headers merge in, same-name keys are overridden by request-level
const http = createAxios({ headers: { 'X-Platform': 'web', 'X-Version': '1.0' } })
http.get('/api', { headers: { 'X-Version': '2.0', 'X-Extra': 'hello' } })
// Final headers: { 'X-Platform': 'web', 'X-Version': '2.0', 'X-Extra': 'hello' }
```

## Exports

```ts
// Classes
export { ZhiAxios, CancelManager, RequestTracker, RequestThrottle, CacheManager }

// Errors
export { ZhiAxiosError, classifyError, ErrorType }

// Factory
export { createAxios }

// Version
export { version }

// Types
export type {
  ApiResponse, AuthOptions, CacheMatcher, CacheOptions, CancelOptions, CreateAxiosOptions,
  ExtendedRequestConfig, RequestOptions, ProgressCallback, RequestEntry, RetryOptions,
  ThrottleOptions, TrackerHooks, ZhiAxiosInstance,
  // Interceptor types
  RequestInterceptor, RequestErrorInterceptor, ResponseInterceptor, ResponseErrorInterceptor,
  RequestInterceptorConfig, ResponseInterceptorConfig,
  // Re-exported from axios
  AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig,
}
```

### Global Types (import-free)

This package ships a `global.d.ts` that injects all public types into the global scope, eliminating the need for frequent `import type` statements.

Add a single line to any `.d.ts` file in your project (e.g. `types/zhiaiwan-axios.d.ts`):

```ts
/// <reference types="@zhiaiwan/axios/global" />
```

Then use all types directly throughout your project — no manual imports needed:

```ts
// No more: import type { ZhiAxiosInstance, ApiResponse, ... } from '@zhiaiwan/axios'
const http: ZhiAxiosInstance = createAxios({ /* ... */ })

async function getUser(): Promise<ApiResponse<UserInfo>> {
  return http.get<UserInfo>('/user/info')
}
```

## Examples

- Run: `pnpm build && pnpm examples`
- URL: `http://localhost:3000`
- Catalog: `examples/README.md`
- Covered capabilities: CRUD + `request(config)`, interceptors (`onRequest`/`onResponse`), token refresh, retry, cancellation (`cancel.key`), cache (`cacheKey`/`cache:false`/`invalidateCache`), throttle, tracker, upload/download, error classification, `destroy()`
- UX rule: fixed top-right `中文 / EN` switch with persisted language preference


## Project Structure

```
zhiaiwan-axios/
├── src/
│   ├── index.ts           # Entry: createAxios factory + all exports
│   ├── types.ts           # TypeScript type definitions
│   ├── core.ts            # ZhiAxios core class
│   ├── tracker.ts         # Request queue tracking (ID, groups, loading, duration, slow requests)
│   ├── interceptors.ts    # Built-in interceptors (cancel / auth / transform / errorHook)
│   ├── cancel.ts          # Request deduplication management
│   ├── retry.ts           # Exponential backoff auto-retry (with methods / shouldRetry)
│   ├── errors.ts          # Error classification (ErrorType / ZhiAxiosError / classifyError)
│   ├── throttle.ts        # Concurrent request limiting
│   ├── cache.ts           # Response caching (TTL)
│   └── logger.ts          # Debug logging
├── tests/                 # Unit tests + integration tests
├── examples/              # Usage examples (17 scenarios, HTML + server.js, run via pnpm examples)
├── dist/                  # Build output (ESM + CJS + .d.ts + global.d.ts)
├── package.json
├── tsconfig.json
├── vite.config.ts         # Vite Library Mode + Terser
├── vitest.config.ts       # Vitest test configuration
├── biome.json             # Biome code quality
└── .changeset/            # Changesets version management
```

## FAQ

### 1) Why do I get a Business Error on a successful HTTP response?

The backend `code` is not included in your `successCode` list.  
Default success code is `0`. Set global or per-request overrides:

```ts
http.get('/legacy-api', { successCode: [200] })
```

### 2) When should I use global retry vs per-request retry?

- Global `retry`: stable default strategy for most requests
- Per-request `retry`: strengthen or disable retry for a specific endpoint

```ts
http.get('/order/create', { retry: false })
http.get('/flaky', { retry: { count: 5, delay: 300 } })
```

### 3) What is the fastest way to debug a failing request chain?

Recommended order:

1. Enable `debug: true` to inspect request/response logs
2. Add `tracker.onRequestStart/onRequestEnd` for timing and queue visibility
3. Branch handling in `onError` by `ErrorType`
4. Use `classifyError(error)` for explicit classification in custom paths

### 4) Why does `download()` return Blob while `get()` returns business JSON?

`download()` forces `responseType: 'blob'` and `responseTransform: false`, so it returns `AxiosResponse<Blob>`.  
`get()` follows normal business response transform semantics.

### 5) What about environments without AbortController?

Cancellation features rely on standard abort signals.  
Use runtime polyfills when needed, or disable deduplicate cancellation and keep basic request flow.

## Development Commands

```bash
# Install dependencies
pnpm install

# Dev mode (watch build)
pnpm dev

# Build
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test:run

# Node artifact smoke test (CJS + ESM)
pnpm test:node:smoke

# Lint
pnpm lint

# Run examples (build first)
pnpm build && pnpm examples
# Then open http://localhost:3000
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Vite](https://vite.dev/) | Library Mode build (Rollup) |
| [TypeScript](https://www.typescriptlang.org/) | Type system |
| [vite-plugin-dts](https://github.com/qmhc/vite-plugin-dts) | `.d.ts` type declaration generation |
| [@rollup/plugin-terser](https://github.com/nicolo-ribaudo/rollup-plugin-terser) | Minification & obfuscation |
| [Vitest](https://vitest.dev/) | Unit testing |
| [Biome](https://biomejs.dev/) | Linter + Formatter |
| [Changesets](https://github.com/changesets/changesets) | Version management & publishing |

## License

[MIT](./LICENSE)
