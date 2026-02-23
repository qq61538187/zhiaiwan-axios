# @zhiaiwan/axios

[![npm version](https://img.shields.io/npm/v/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![npm downloads](https://img.shields.io/npm/dm/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![CI](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml/badge.svg)](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[中文](./README.md) | **English**

A modern, type-safe HTTP client built on top of axios, providing out-of-the-box request queue tracking, group cancellation, automatic retry, token refresh, error classification, concurrency limiting, response caching, and debug logging.

## Requirements

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

## Full Configuration

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
  retry: false,                  // Disable retry for this request
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

## CreateAxiosOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `baseURL` | `string` | — | Base request URL |
| `timeout` | `number` | — | Timeout in ms |
| `headers` | `object` | — | Default request headers |
| `requestInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | Custom request interceptors (registered at creation) |
| `responseInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | Custom response interceptors (registered at creation) |
| `cancel.deduplicate` | `boolean` | `false` | Auto-cancel duplicate requests |
| `retry.count` | `number` | `0` | Max retry attempts |
| `retry.delay` | `number` | `1000` | Initial retry delay (ms) |
| `retry.statusCodes` | `number[]` | `[408,500,502,503,504]` | Status codes that trigger retry |
| `retry.maxDelay` | `number` | `30000` | Max retry delay (ms), caps exponential backoff |
| `retry.methods` | `string[]` | `['GET','HEAD','OPTIONS','PUT','DELETE']` | Methods allowed to retry |
| `retry.shouldRetry` | `(error, count) => boolean` | — | Custom retry predicate |
| `auth.getToken` | `() => string \| null \| Promise<...>` | — | Get current token |
| `auth.refreshToken` | `() => Promise<string>` | — | Refresh token |
| `auth.headerName` | `string` | `'Authorization'` | Token header name |
| `auth.tokenPrefix` | `string` | `'Bearer'` | Token prefix |
| `auth.onUnauthorized` | `() => void` | — | Callback when refresh fails |
| `successCode` | `number \| number[]` | `[0]` | Business success codes |
| `onError` | `(error, type, config?) => void \| false \| T` | — | Global error hook: `void` throws normally, `false` swallows, other values resolve as fallback data |
| `responseTransform` | `false \| (res) => unknown` | Unwraps `response.data` | Response transformation |
| `tracker.onQueueChange` | `(queue) => void` | — | Queue change callback |
| `tracker.onLoadingChange` | `(loading) => void` | — | Loading state change callback |
| `tracker.onRequestStart` | `(entry) => void` | — | Request start callback |
| `tracker.onRequestEnd` | `(entry) => void` | — | Request end callback (includes duration) |
| `tracker.slowThreshold` | `number` | `0` (disabled) | Slow request threshold (ms) |
| `tracker.onSlowRequest` | `(entry) => void` | — | Slow request callback |
| `throttle.maxConcurrent` | `number` | `Infinity` | Max concurrent requests |
| `cache.ttl` | `number` | `0` (disabled) | Cache TTL (ms), in-memory cache |
| `cache.methods` | `string[]` | `['GET']` | Methods to cache |
| `debug` | `boolean \| (msg, ...args) => void` | `false` | Debug logging |

> All native [AxiosRequestConfig](https://axios-http.com/docs/req_config) properties are also accepted.

### Per-request Extra Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | Custom request ID |
| `requestGroup` | `string` | Request group tag |
| `successCode` | `number \| number[]` | Override global success codes |
| `responseTransform` | `false \| (res) => unknown` | Override global response transform |
| `retry` | `RetryOptions \| false` | Override global retry config, `false` to disable |

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
  ApiResponse, AuthOptions, CacheOptions, CancelOptions, CreateAxiosOptions,
  ExtendedRequestConfig, RequestOptions, ProgressCallback, RequestEntry, RetryOptions,
  ThrottleOptions, TrackerHooks, ZhiAxiosInstance,
  // Interceptor types
  RequestInterceptor, RequestErrorInterceptor, ResponseInterceptor, ResponseErrorInterceptor,
  RequestInterceptorConfig, ResponseInterceptorConfig,
  // Re-exported from axios
  AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig,
}
```

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
├── dist/                  # Build output (ESM + CJS + .d.ts)
├── package.json
├── tsconfig.json
├── vite.config.ts         # Vite Library Mode + Terser
├── vitest.config.ts       # Vitest test configuration
├── biome.json             # Biome code quality
└── .changeset/            # Changesets version management
```

## Development

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
