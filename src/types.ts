import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export interface CancelOptions {
  /**
   * Automatically cancel duplicate in-flight requests (same method + url).
   * @default false
   */
  deduplicate?: boolean
  /**
   * Deduplication key strategy.
   * - `method-url`: method + url (legacy/default behavior)
   * - `method-url-params-data`: method + url + params + data
   * - custom function: return your own dedupe key
   * @default 'method-url'
   */
  key?: 'method-url' | 'method-url-params-data' | ((config: AxiosRequestConfig) => string)
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /**
   * Max number of retries on network / 5xx errors.
   * @default 0 (disabled)
   */
  count?: number
  /**
   * Base delay in ms before the first retry (doubles on each subsequent).
   * @default 1000
   */
  delay?: number
  /**
   * Maximum delay in ms between retries (caps exponential backoff).
   * @default 30000
   */
  maxDelay?: number
  /**
   * HTTP status codes that should trigger a retry.
   * @default [408, 500, 502, 503, 504]
   */
  statusCodes?: number[]
  /**
   * HTTP methods that are safe to retry.
   * @default ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']
   */
  methods?: string[]
  /**
   * Custom function to determine whether a request should be retried.
   * Takes precedence over `statusCodes` and `methods` when provided.
   * Return `true` to retry, `false` to skip.
   */
  shouldRetry?: (error: AxiosError, retryCount: number) => boolean
}

// ---------------------------------------------------------------------------
// Auth / Token
// ---------------------------------------------------------------------------

export interface AuthOptions {
  /** Return the current access token (sync or async). */
  getToken: () => string | null | undefined | Promise<string | null | undefined>
  /** Called when a 401 is received; should return a fresh access token. */
  refreshToken?: () => Promise<string>
  /** Token header name. @default 'Authorization' */
  headerName?: string
  /** Token prefix. @default 'Bearer' */
  tokenPrefix?: string
  /** Called when token refresh fails or no refreshToken fn is provided. */
  onUnauthorized?: () => void
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

export type RequestInterceptor = (
  config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>

export type RequestErrorInterceptor = (error: AxiosError) => Promise<never>

export type ResponseInterceptor = (
  response: AxiosResponse,
) => AxiosResponse | Promise<AxiosResponse>

export type ResponseErrorInterceptor = (error: AxiosError) => Promise<never>

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

export enum ErrorType {
  /** No network / DNS failure / connection refused. */
  Network = 'network',
  /** Request exceeded the timeout limit. */
  Timeout = 'timeout',
  /** HTTP status error (4xx / 5xx). */
  Http = 'http',
  /** Business code mismatch (code not in successCode list). */
  Business = 'business',
  /** Request was cancelled via AbortController. */
  Cancel = 'cancel',
  /** Unknown / uncategorized error. */
  Unknown = 'unknown',
}

// ---------------------------------------------------------------------------
// Throttle
// ---------------------------------------------------------------------------

export interface ThrottleOptions {
  /**
   * Maximum number of concurrent requests. Excess requests are queued.
   * @default Infinity
   */
  maxConcurrent?: number
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export interface CacheOptions {
  /**
   * Cache time-to-live in milliseconds.
   * @default 0 (disabled)
   */
  ttl?: number
  /**
   * HTTP methods to cache.
   * @default ['GET']
   */
  methods?: string[]
}

export type CacheMatcher = string | RegExp | ((key: string) => boolean)

// ---------------------------------------------------------------------------
// Request Tracker
// ---------------------------------------------------------------------------

/** Snapshot of a single in-flight request. */
export interface RequestEntry {
  /** Unique request ID (auto-generated or user-specified via `requestId`). */
  id: string
  /** Optional group tag for batch cancellation. */
  group?: string
  /** HTTP method. */
  method: string
  /** Request URL. */
  url: string
  /** Timestamp when the request was initiated. */
  startedAt: number
  /** Duration in ms (only available in onRequestEnd). */
  duration?: number
}

/** Hooks that fire when the request queue changes. */
export interface TrackerHooks {
  /** Fires whenever a request is added or removed. Receives current queue snapshot. */
  onQueueChange?: (queue: ReadonlyArray<RequestEntry>) => void
  /** Fires when `loading` state transitions between `true` and `false`. */
  onLoadingChange?: (loading: boolean) => void
  /** Fires when a new request starts. */
  onRequestStart?: (entry: RequestEntry) => void
  /** Fires when a request completes (success or error). */
  onRequestEnd?: (entry: RequestEntry) => void
  /**
   * Time in ms after which a request is considered slow.
   * When exceeded, `onSlowRequest` fires.
   * @default 0 (disabled)
   */
  slowThreshold?: number
  /** Fires when a request exceeds `slowThreshold`. */
  onSlowRequest?: (entry: RequestEntry) => void
}

// ---------------------------------------------------------------------------
// Upload / Download
// ---------------------------------------------------------------------------

export type ProgressCallback = (event: { loaded: number; total: number; percent: number }) => void

// ---------------------------------------------------------------------------
// Per-request Options (public — for consumers to use)
// ---------------------------------------------------------------------------

/** Per-request extension fields that consumers can pass to get/post/etc. */
export interface RequestOptions extends AxiosRequestConfig {
  /** User-specified request ID. Auto-generated if not provided. */
  requestId?: string
  /** Group tag for the request. Used for batch cancellation. */
  requestGroup?: string
  /** Per-request success code override. */
  successCode?: number | number[]
  /** Per-request response transform override. */
  responseTransform?: false | ((response: AxiosResponse) => unknown)
  /** Per-request retry override. Set `false` to disable retry for this request. */
  retry?: RetryOptions | false
  /** Per-request cache toggle. Set `false` to skip cache read/write for this request. */
  cache?: boolean
  /** Per-request cache key override. */
  cacheKey?: string
}

// ---------------------------------------------------------------------------
// Extended Request Config (internal — after interceptors run)
// ---------------------------------------------------------------------------

/** Internal representation after Axios merges config. */
export interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
  /** User-specified request ID. Auto-generated if not provided. */
  requestId?: string
  /** Group tag for the request. Used for batch cancellation. */
  requestGroup?: string
  /** Per-request success code override. */
  successCode?: number | number[]
  /** Per-request response transform override. */
  responseTransform?: false | ((response: AxiosResponse) => unknown)
  /** Per-request retry override. Set `false` to disable retry for this request. */
  retry?: RetryOptions | false
  /** Per-request cache toggle. Set `false` to skip cache read/write for this request. */
  cache?: boolean
  /** Per-request cache key override. */
  cacheKey?: string
}

/**
 * Internal config with library-managed fields.
 * These fields should NOT be set by consumers.
 * @internal
 */
export interface InternalRequestConfig extends ExtendedRequestConfig {
  /** @internal */ _retryCount?: number
  /** @internal */ _retried?: boolean
  /** @internal */ _skipCancel?: boolean
  /** @internal */ _trackerId?: string
  /** @internal */ _skipCache?: boolean
  /** @internal */ _fromCache?: boolean
}

// ---------------------------------------------------------------------------
// Interceptor Config (for create-time registration)
// ---------------------------------------------------------------------------

/**
 * An interceptor entry can be either a plain function or
 * an object with `fulfilled` and optional `rejected` handler.
 */
export type RequestInterceptorConfig =
  | RequestInterceptor
  | { fulfilled: RequestInterceptor; rejected?: RequestErrorInterceptor }

export type ResponseInterceptorConfig =
  | ResponseInterceptor
  | { fulfilled: ResponseInterceptor; rejected?: ResponseErrorInterceptor }

// ---------------------------------------------------------------------------
// Create Options
// ---------------------------------------------------------------------------

export interface CreateAxiosOptions extends Omit<AxiosRequestConfig, 'auth'> {
  /**
   * Custom request interceptors registered at creation time.
   *
   * Execution order: all internal interceptors (auth, cancel, tracker …)
   * run first, then your custom interceptors run — so you can see
   * the fully prepared config (e.g. auth token already injected).
   */
  requestInterceptors?: RequestInterceptorConfig[]
  /**
   * Custom response interceptors registered at creation time.
   *
   * Execution order: your custom interceptors run first (on the raw
   * HTTP response), then internal interceptors (retry, transform,
   * business code check, error hook) run afterward.
   */
  responseInterceptors?: ResponseInterceptorConfig[]
  /** Request cancellation / deduplication. */
  cancel?: CancelOptions
  /** Automatic retry on failure. */
  retry?: RetryOptions
  /** Token injection & refresh. */
  auth?: AuthOptions
  /**
   * Business-level success code(s). If `response.data.code` exists and is not
   * included in this list, the request is rejected with a business error.
   * @default [0]
   */
  successCode?: number | number[]
  /**
   * Transform the raw AxiosResponse before resolving.
   * Defaults to returning `response.data` (the backend JSON body).
   * Set to `false` to receive the full AxiosResponse.
   */
  responseTransform?: false | ((response: AxiosResponse) => unknown)
  /**
   * Global error hook. Fires on every request failure.
   * Receives the classified error type for easy branching.
   *
   * Return values:
   * - `void` / `undefined`: error is re-thrown normally
   * - `false`: error is swallowed, promise resolves with `undefined`
   * - any other value: error is swallowed, promise resolves with that value (fallback data)
   */
  onError?: (
    error: AxiosError | Error,
    type: ErrorType,
    config?: AxiosRequestConfig,
  ) => undefined | false | unknown
  /** Request queue tracker hooks. */
  tracker?: TrackerHooks
  /** Concurrent request throttling. */
  throttle?: ThrottleOptions
  /** GET response caching. */
  cache?: CacheOptions
  /**
   * Enable debug logging to console.
   * Pass `true` for default logger, or a custom log function.
   * @default false
   */
  debug?: boolean | ((msg: string, ...args: unknown[]) => void)
}

// ---------------------------------------------------------------------------
// ZhiAxios Instance
// ---------------------------------------------------------------------------

export interface ZhiAxiosInstance {
  readonly axios: AxiosInstance

  /** `true` when at least one request is in flight. */
  readonly loading: boolean
  /** Snapshot of all in-flight requests. */
  readonly queue: ReadonlyArray<RequestEntry>

  get<T = unknown>(url: string, config?: RequestOptions): Promise<ApiResponse<T>>
  post<T = unknown>(url: string, data?: unknown, config?: RequestOptions): Promise<ApiResponse<T>>
  put<T = unknown>(url: string, data?: unknown, config?: RequestOptions): Promise<ApiResponse<T>>
  patch<T = unknown>(url: string, data?: unknown, config?: RequestOptions): Promise<ApiResponse<T>>
  delete<T = unknown>(url: string, config?: RequestOptions): Promise<ApiResponse<T>>
  request<T = unknown>(config: RequestOptions): Promise<ApiResponse<T>>

  /** Upload a file with progress tracking. */
  upload<T = unknown>(
    url: string,
    data: FormData | Record<string, unknown>,
    config?: RequestOptions & { onProgress?: ProgressCallback },
  ): Promise<ApiResponse<T>>

  /** Download with progress tracking. */
  download(
    url: string,
    config?: RequestOptions & { onProgress?: ProgressCallback },
  ): Promise<AxiosResponse<Blob>>

  /** Register a request interceptor. Returns disposer function. */
  onRequest(fn: RequestInterceptor, onError?: RequestErrorInterceptor): () => void
  /** Register a response interceptor. Returns disposer function. */
  onResponse(fn: ResponseInterceptor, onError?: ResponseErrorInterceptor): () => void

  /** Abort all pending requests. */
  cancelAll(): void
  /** Abort all pending requests in a specific group. */
  cancelGroup(group: string): void
  /** Abort a specific request by its ID. */
  cancelById(id: string): void
  /** Clear the response cache. */
  clearCache(): void
  /** Invalidate cache entries by key, RegExp, or matcher function. */
  invalidateCache(matcher: CacheMatcher): number
  /** Cancel all requests, clear cache, and remove all interceptors. */
  destroy(): void
}
