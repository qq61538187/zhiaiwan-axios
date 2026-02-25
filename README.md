# @zhiaiwan/axios

[![npm version](https://img.shields.io/npm/v/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![npm downloads](https://img.shields.io/npm/dm/@zhiaiwan/axios)](https://www.npmjs.com/package/@zhiaiwan/axios)
[![CI](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml/badge.svg)](https://github.com/qq61538187/zhiaiwan-axios/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**中文** | [English](./README.en.md)

基于 axios 二次封装的现代化、类型安全的 HTTP 客户端，开箱即用地提供请求队列追踪、分组取消、自动重试、Token 刷新、错误分类、并发限制、响应缓存和 Debug 日志。

### 环境要求

- Node.js >= 20

## 安装

axios 已内置为依赖，无需单独安装。

```bash
# pnpm
pnpm add @zhiaiwan/axios

# npm
npm install @zhiaiwan/axios

# yarn
yarn add @zhiaiwan/axios
```

## 快速开始

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

### 完整配置示例

```ts
import { createAxios } from '@zhiaiwan/axios'

const http = createAxios({
  // --- axios 原生选项 ---
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },

  // --- 请求去重 ---
  cancel: {
    deduplicate: true,
    key: 'method-url-params-data',
  },

  // --- 自动重试 ---
  retry: {
    count: 3,
    delay: 1000,
    maxDelay: 30000,
    statusCodes: [408, 500, 502, 503, 504],
    methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
    shouldRetry: (error, retryCount) => {
      // 自定义重试判断（优先级最高）
      return retryCount < 2
    },
  },

  // --- Token 管理 ---
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

  // --- 业务码（支持多个成功码）---
  successCode: [0, 200],

  // --- 全局异常钩子（含错误类型分类）---
  onError: (error, type, config) => {
    // type: 'network' | 'timeout' | 'http' | 'business' | 'cancel' | 'unknown'
    if (type === 'cancel') return
    if (type === 'network') return { code: 0, data: null, message: '网络不可用' } // 返回降级数据
    message.error(error.message || '请求失败')
    // 返回 void: 正常抛错 | false: 吞掉错误 | 其他值: 作为降级数据 resolve
  },

  // --- 请求队列与慢请求钩子 ---
  tracker: {
    onLoadingChange: (loading) => store.setGlobalLoading(loading),
    onQueueChange: (queue) => console.log('进行中:', queue.length),
    onRequestStart: (entry) => console.log(`→ ${entry.method} ${entry.url}`),
    onRequestEnd: (entry) => console.log(`← ${entry.url} [${entry.duration}ms]`),
    slowThreshold: 10000,
    onSlowRequest: (entry) => console.warn(`慢请求: ${entry.url} 已耗时 ${entry.duration}ms`),
  },

  // --- 并发限制 ---
  throttle: { maxConcurrent: 6 },

  // --- GET 响应缓存 ---
  cache: { ttl: 30000, methods: ['GET'] },

  // --- Debug 日志 ---
  debug: true,
})
```

## API 参考

### `createAxios(options?)`

工厂函数，创建 `ZhiAxios` 实例。

```ts
const http = createAxios(options?: CreateAxiosOptions): ZhiAxios
```

### 请求方法

所有方法返回 `Promise<ApiResponse<T>>`，其中 `ApiResponse` 结构为：

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

每个请求的 `config` 支持额外字段：

```ts
http.get('/users', {
  requestId: 'fetch-users',      // 自定义请求 ID（不传则自动生成）
  requestGroup: 'user-module',   // 请求分组标签
  successCode: [0, 200],         // 仅此请求的成功码（覆盖全局）
  responseTransform: false,      // 仅此请求禁用解包（覆盖全局）
  retry: { count: 5 },           // 仅此请求的重试配置（覆盖全局）
  cache: false,                  // 跳过此请求缓存读写
  cacheKey: 'user:list',         // 自定义缓存 key
})
```

### 上传与下载

```ts
// 文件上传（自动设置 Content-Type: multipart/form-data）
const formData = new FormData()
formData.append('file', file)

await http.upload('/upload', formData, {
  onProgress: ({ loaded, total, percent }) => {
    console.log(`上传进度: ${percent}%`)
  },
})

// 也支持传入普通对象，自动转为 FormData
await http.upload('/upload', { file, name: 'avatar' })

// 文件下载（返回完整 AxiosResponse<Blob>）
const response = await http.download('/file/export', {
  onProgress: ({ loaded, total, percent }) => {
    console.log(`下载进度: ${percent}%`)
  },
})
const blob = response.data
```

### 请求队列与 Loading 状态

```ts
http.loading // boolean — 是否有请求正在进行
http.queue   // ReadonlyArray<RequestEntry> — 进行中的请求快照
```

`RequestEntry` 结构：

```ts
interface RequestEntry {
  id: string         // 请求 ID
  group?: string     // 分组标签
  method: string     // HTTP 方法
  url: string        // 请求 URL
  startedAt: number  // 发起时间戳
  duration?: number  // 耗时 ms（仅在 onRequestEnd 中可用）
}
```

### 取消请求

```ts
http.cancelById('fetch-users')    // 取消指定 ID
http.cancelGroup('user-module')   // 取消指定分组
http.cancelAll()                  // 取消所有
```

### 缓存管理

```ts
http.clearCache() // 清空所有响应缓存
http.invalidateCache(/^users:/) // 按 key / 正则 / 函数匹配失效缓存，返回移除条数
```

### 生命周期钩子（TrackerHooks）

通过 `tracker` 选项配置，所有钩子均为可选：

| 钩子 | 触发时机 | 回调参数 |
|------|----------|----------|
| `onQueueChange` | 每次请求入队或出队 | `(queue: RequestEntry[]) => void` |
| `onLoadingChange` | loading 状态变化 | `(loading: boolean) => void` |
| `onRequestStart` | 新请求发起时 | `(entry: RequestEntry) => void` |
| `onRequestEnd` | 请求完成时（含 `duration`） | `(entry: RequestEntry) => void` |
| `onSlowRequest` | 请求超过 `slowThreshold` | `(entry: RequestEntry) => void` |

> `onLoadingChange` 只在状态真正切换时触发，不会在每个请求进出时都触发。

### 错误分类

所有错误自动分类为 `ErrorType`：

```ts
import { ErrorType, ZhiAxiosError, classifyError } from '@zhiaiwan/axios'

// ErrorType 枚举
ErrorType.Network   // 无网络 / DNS 失败 / 连接拒绝
ErrorType.Timeout   // 请求超时
ErrorType.Http      // HTTP 状态码错误（4xx / 5xx）
ErrorType.Business  // 业务码不在 successCode 中
ErrorType.Cancel    // 请求被主动取消
ErrorType.Unknown   // 未知错误

// ZhiAxiosError 包含分类信息
try {
  await http.get('/api')
} catch (err) {
  if (err instanceof ZhiAxiosError) {
    console.log(err.type)         // ErrorType
    console.log(err.status)       // HTTP 状态码
    console.log(err.businessCode) // 业务码
    console.log(err.raw)          // 原始错误
  }
}

// 也可手动分类任意错误
const type = classifyError(someError) // => ErrorType
```

### 拦截器

#### 方式一：创建时声明（推荐）

通过 `requestInterceptors` / `responseInterceptors` 在实例创建时注册：

```ts
const http = createAxios({
  baseURL: '/api',
  requestInterceptors: [
    // 简写：直接传函数
    (config) => {
      config.headers['X-Request-Id'] = crypto.randomUUID()
      return config
    },
    // 完整写法：含错误处理
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

**执行顺序说明：**

- **请求拦截器**：内部拦截器（auth token 注入、cancel 去重等）先执行，用户自定义拦截器最后执行 → 你拿到的是已完全准备好的 config
- **响应拦截器**：用户自定义拦截器先执行（拿到原始 HTTP 响应），然后内部拦截器（retry、transform、业务码校验）再处理

#### 方式二：运行时注册

通过 `onRequest` / `onResponse` 方法动态注册，返回卸载函数：

```ts
const dispose = http.onRequest((config) => {
  config.headers['X-Request-Id'] = crypto.randomUUID()
  return config
})

const dispose2 = http.onResponse((response) => {
  console.log('Response:', response.status)
  return response
})

// 卸载
dispose()
dispose2()
```

### 访问底层 axios 实例

```ts
http.axios.defaults.headers.common['X-App'] = 'my-app'
```

## 配置表（CreateAxiosOptions）

| 属性 | 类型 | 默认值 | 说明 | 加入版本（since） | 是否弃用 | 替代项 |
|------|------|--------|------|--------------------|----------|--------|
| `baseURL` | `string` | — | 请求基础路径 | `1.1.0` | 否 | - |
| `timeout` | `number` | — | 超时时间（ms） | `1.1.0` | 否 | - |
| `headers` | `object` | — | 默认请求头 | `1.1.0` | 否 | - |
| `requestInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | 自定义请求拦截器（创建时注册） | `1.1.0` | 否 | - |
| `responseInterceptors` | `Array<Function \| { fulfilled, rejected? }>` | — | 自定义响应拦截器（创建时注册） | `1.1.0` | 否 | - |
| `cancel.deduplicate` | `boolean` | `false` | 自动取消重复请求 | `1.1.0` | 否 | - |
| `cancel.key` | `'method-url' \| 'method-url-params-data' \| ((config)=>string)` | `'method-url'` | 重复请求判定 key 策略 | `1.1.0` | 否 | - |
| `retry.count` | `number` | `0` | 最大重试次数 | `1.1.0` | 否 | - |
| `retry.delay` | `number` | `1000` | 首次重试延迟（ms） | `1.1.0` | 否 | - |
| `retry.statusCodes` | `number[]` | `[408,500,502,503,504]` | 触发重试的状态码 | `1.1.0` | 否 | - |
| `retry.maxDelay` | `number` | `30000` | 最大重试延迟（ms），封顶指数退避 | `1.1.0` | 否 | - |
| `retry.methods` | `string[]` | `['GET','HEAD','OPTIONS','PUT','DELETE']` | 允许重试的方法 | `1.1.0` | 否 | - |
| `retry.shouldRetry` | `(error, count) => boolean` | — | 自定义重试判断 | `1.1.0` | 否 | - |
| `auth.getToken` | `() => string \| null \| Promise<...>` | — | 获取当前 Token | `1.1.0` | 否 | - |
| `auth.refreshToken` | `() => Promise<string>` | — | 刷新 Token | `1.1.0` | 否 | - |
| `auth.headerName` | `string` | `'Authorization'` | Token 头名称 | `1.1.0` | 否 | - |
| `auth.tokenPrefix` | `string` | `'Bearer'` | Token 前缀 | `1.1.0` | 否 | - |
| `auth.onUnauthorized` | `() => void` | — | 刷新失败回调 | `1.1.0` | 否 | - |
| `successCode` | `number \| number[]` | `[0]` | 业务成功码 | `1.1.0` | 否 | - |
| `onError` | `(error, type, config?) => void \| false \| T` | — | 全局异常钩子：`void` 正常抛错，`false` 吞掉，返回其他值作为降级数据 resolve | `1.1.0` | 否 | - |
| `responseTransform` | `false \| (res) => unknown` | 解包 `response.data` | 响应转换 | `1.1.0` | 否 | - |
| `tracker.onQueueChange` | `(queue) => void` | — | 队列变化回调 | `1.1.0` | 否 | - |
| `tracker.onLoadingChange` | `(loading) => void` | — | loading 切换回调 | `1.1.0` | 否 | - |
| `tracker.onRequestStart` | `(entry) => void` | — | 请求发起回调 | `1.1.0` | 否 | - |
| `tracker.onRequestEnd` | `(entry) => void` | — | 请求结束回调（含 duration） | `1.1.0` | 否 | - |
| `tracker.slowThreshold` | `number` | `0`（禁用） | 慢请求阈值（ms） | `1.1.0` | 否 | - |
| `tracker.onSlowRequest` | `(entry) => void` | — | 慢请求回调 | `1.1.0` | 否 | - |
| `throttle.maxConcurrent` | `number` | `Infinity` | 最大并发请求数 | `1.1.0` | 否 | - |
| `cache.ttl` | `number` | `0`（禁用） | 缓存过期时间（ms），内存缓存 | `1.1.0` | 否 | - |
| `cache.methods` | `string[]` | `['GET']` | 缓存的方法 | `1.1.0` | 否 | - |
| `debug` | `boolean \| (msg, ...args) => void` | `false` | 调试日志 | `1.1.0` | 否 | - |

> 除以上扩展属性外，所有 [AxiosRequestConfig](https://axios-http.com/docs/req_config) 原生属性均可传入。

### Per-request 额外字段

| 字段 | 类型 | 说明 | 加入版本（since） | 是否弃用 | 替代项 |
|------|------|------|--------------------|----------|--------|
| `requestId` | `string` | 自定义请求 ID | `1.1.0` | 否 | - |
| `requestGroup` | `string` | 请求分组标签 | `1.1.0` | 否 | - |
| `successCode` | `number \| number[]` | 覆盖全局成功码 | `1.1.0` | 否 | - |
| `responseTransform` | `false \| (res) => unknown` | 覆盖全局响应转换 | `1.1.0` | 否 | - |
| `retry` | `RetryOptions \| false` | 覆盖全局重试配置，`false` 禁用 | `1.1.0` | 否 | - |
| `cache` | `boolean` | `false` 时跳过本次请求缓存读写 | `1.1.0` | 否 | - |
| `cacheKey` | `string` | 覆盖默认缓存 key（可跨请求复用） | `1.1.0` | 否 | - |

所有方法（`get`/`post`/`put`/`patch`/`delete`/`request`/`upload`/`download`）均接受 `RequestOptions` 类型，支持直接传入上述扩展字段，无需 `as any`：

```ts
// 直接传扩展字段，类型安全
http.get('/api/user', {
  requestId: 'fetch-user',
  requestGroup: 'user',
  successCode: [0, 200],
  retry: { count: 5 },
})

// headers 合并策略：创建时的 headers 为默认值，请求时传的 headers 与之合并，同名 key 请求级覆盖默认级
const http = createAxios({ headers: { 'X-Platform': 'web', 'X-Version': '1.0' } })
http.get('/api', { headers: { 'X-Version': '2.0', 'X-Extra': 'hello' } })
// 最终 headers: { 'X-Platform': 'web', 'X-Version': '2.0', 'X-Extra': 'hello' }
```

## 导出一览

```ts
// 类
export { ZhiAxios, CancelManager, RequestTracker, RequestThrottle, CacheManager }

// 错误
export { ZhiAxiosError, classifyError, ErrorType }

// 工厂
export { createAxios }

// 版本号
export { version }

// 类型
export type {
  ApiResponse, AuthOptions, CacheMatcher, CacheOptions, CancelOptions, CreateAxiosOptions,
  ExtendedRequestConfig, RequestOptions, ProgressCallback, RequestEntry, RetryOptions,
  ThrottleOptions, TrackerHooks, ZhiAxiosInstance,
  // 拦截器类型
  RequestInterceptor, RequestErrorInterceptor, ResponseInterceptor, ResponseErrorInterceptor,
  RequestInterceptorConfig, ResponseInterceptorConfig,
  // Re-exported from axios
  AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig,
}
```

### 全局类型（免 import）

本包提供 `global.d.ts`，可将所有公开类型注入全局，省去频繁 `import type`。

在项目的任意 `.d.ts` 文件（如 `types/zhiaiwan-axios.d.ts`）中添加一行：

```ts
/// <reference types="@zhiaiwan/axios/global" />
```

之后即可在整个项目中直接使用所有类型，无需手动导入：

```ts
// 不再需要 import type { ZhiAxiosInstance, ApiResponse, ... } from '@zhiaiwan/axios'
const http: ZhiAxiosInstance = createAxios({ /* ... */ })

async function getUser(): Promise<ApiResponse<UserInfo>> {
  return http.get<UserInfo>('/user/info')
}
```

## 示例

- 运行方式：`pnpm build && pnpm examples`
- 访问地址：`http://localhost:3000`
- 示例总览：`examples/README.md`
- 已覆盖能力：基础 CRUD + `request(config)`、拦截器（`onRequest`/`onResponse`）、Token 刷新、重试、取消（含 `cancel.key`）、缓存（含 `cacheKey`/`cache:false`/`invalidateCache`）、限流、队列追踪、上传下载、错误分类、`destroy()`
- 交互规范：页面右上角支持 `中文 / EN` 切换，并持久化语言选择


## 项目结构

```
zhiaiwan-axios/
├── src/
│   ├── index.ts           # 入口：createAxios 工厂函数 + 全部导出
│   ├── types.ts           # TypeScript 类型定义
│   ├── core.ts            # ZhiAxios 核心类
│   ├── tracker.ts         # 请求队列追踪（ID、分组、loading、duration、慢请求）
│   ├── interceptors.ts    # 内置拦截器（cancel / auth / transform / errorHook）
│   ├── cancel.ts          # 请求去重管理
│   ├── retry.ts           # 指数退避自动重试（含 methods / shouldRetry）
│   ├── errors.ts          # 错误分类（ErrorType / ZhiAxiosError / classifyError）
│   ├── throttle.ts        # 并发请求限制
│   ├── cache.ts           # 响应缓存（TTL）
│   └── logger.ts          # Debug 日志
├── tests/                 # 单元测试 + 集成测试
├── examples/              # 使用示例（17 个场景，HTML + server.js，pnpm examples 运行）
├── dist/                  # 构建产物（ESM + CJS + .d.ts + global.d.ts）
├── package.json
├── tsconfig.json
├── vite.config.ts         # Vite Library Mode + Terser
├── vitest.config.ts       # Vitest 测试配置
├── biome.json             # Biome 代码质量
└── .changeset/            # Changesets 版本管理
```

## FAQ / 常见问题

### 1) 为什么请求成功了却抛出 Business Error？

后端返回的 `code` 不在当前 `successCode` 列表中。默认只认 `0`。  
可在全局配置 `successCode: [0, 200]`，或在单请求中覆盖：

```ts
http.get('/legacy-api', { successCode: [200] })
```

### 2) 什么时候用全局 `retry`，什么时候用单请求 `retry`？

- 全局 `retry`：适合稳定的统一重试策略（如 GET 请求短暂网络抖动）
- 单请求 `retry`：适合个别接口强化/禁用重试

```ts
http.get('/order/create', { retry: false })
http.get('/flaky', { retry: { count: 5, delay: 300 } })
```

### 3) 如何快速排查请求链路问题？

推荐按这个顺序：

1. 打开 `debug: true` 查看请求日志
2. 结合 `tracker.onRequestStart/onRequestEnd` 查看耗时与队列
3. 在 `onError` 中按 `ErrorType` 分支处理并记录日志
4. 对异常链路使用 `classifyError(error)` 二次确认错误类型

### 4) 为什么有时下载返回的是 Blob，有时是业务 JSON？

`download()` 默认强制 `responseType: 'blob'` 且 `responseTransform: false`，返回完整 `AxiosResponse<Blob>`。  
如果你用 `get()` 请求下载接口，会走普通业务解包流程，语义不同。

### 5) 旧浏览器或不支持 AbortController 的环境怎么办？

请先确认运行时 polyfill。该库的取消能力依赖标准中断信号。  
如无法提供中断能力，可禁用去重取消，或仅使用基础请求能力。

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（watch 构建）
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck

# 运行测试
pnpm test:run

# Node 产物冒烟（CJS + ESM）
pnpm test:node:smoke

# 代码检查
pnpm lint

# 运行示例（先 build）
pnpm build && pnpm examples
# 然后打开 http://localhost:3000
```

## 技术栈

| 工具 | 用途 |
|------|------|
| [Vite](https://vite.dev/) | Library Mode 构建（Rollup） |
| [TypeScript](https://www.typescriptlang.org/) | 类型系统 |
| [vite-plugin-dts](https://github.com/qmhc/vite-plugin-dts) | `.d.ts` 类型声明生成 |
| [@rollup/plugin-terser](https://github.com/nicolo-ribaudo/rollup-plugin-terser) | 混淆压缩 |
| [Vitest](https://vitest.dev/) | 单元测试 |
| [Biome](https://biomejs.dev/) | Linter + Formatter |
| [Changesets](https://github.com/changesets/changesets) | 版本管理与发布 |

## License

[MIT](./LICENSE)
