import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { CacheManager, installCache } from './cache'
import { installAuth, installCancel, installErrorHook, installTransform } from './interceptors'
import { installLogger } from './logger'
import { installRetry } from './retry'
import { RequestThrottle, installThrottle } from './throttle'
import { RequestTracker, installTracker, installTrackerCleanup } from './tracker'
import type {
  ApiResponse,
  CreateAxiosOptions,
  ProgressCallback,
  RequestEntry,
  RequestErrorInterceptor,
  RequestInterceptor,
  RequestOptions,
  ResponseErrorInterceptor,
  ResponseInterceptor,
  ZhiAxiosInstance,
} from './types'

declare const __VERSION__: string

export class ZhiAxios implements ZhiAxiosInstance {
  static readonly version: string = __VERSION__
  readonly axios: AxiosInstance
  private tracker: RequestTracker
  private cacheManager: CacheManager | null = null

  constructor(options: CreateAxiosOptions = {}) {
    const {
      requestInterceptors,
      responseInterceptors,
      cancel,
      retry,
      auth,
      tracker: trackerHooks,
      throttle: throttleOpts,
      cache: cacheOpts,
      debug,
      onError,
      successCode: _successCode,
      responseTransform: _responseTransform,
      ...axiosConfig
    } = options

    this.axios = axios.create(axiosConfig)
    this.tracker = new RequestTracker(trackerHooks)

    /*
     * Interceptor installation order matters.
     *
     * Axios request interceptors execute in LIFO (last added = first executed).
     * Axios response interceptors execute in FIFO (first added = first executed).
     *
     * By adding user interceptors FIRST, we get:
     *   Request:  internal (auth→cancel→…) run first → user interceptors run last
     *             → user sees fully prepared config (token injected, etc.)
     *   Response: user interceptors run first (raw HTTP response) → then internal
     *             (retry, transform, business code) run afterward.
     */

    // 0a. User request interceptors (added first → run last in request chain)
    if (requestInterceptors?.length) {
      for (const entry of requestInterceptors) {
        if (typeof entry === 'function') {
          this.axios.interceptors.request.use(entry)
        } else {
          this.axios.interceptors.request.use(entry.fulfilled, entry.rejected)
        }
      }
    }

    // 0b. User response interceptors (added first → run first in response chain)
    if (responseInterceptors?.length) {
      for (const entry of responseInterceptors) {
        if (typeof entry === 'function') {
          this.axios.interceptors.response.use(entry)
        } else {
          this.axios.interceptors.response.use(entry.fulfilled, entry.rejected)
        }
      }
    }

    // 1. Debug logger
    if (debug) {
      const logFn =
        typeof debug === 'function'
          ? debug
          : (msg: string, ...args: unknown[]) => console.log(`[ZhiAxios] ${msg}`, ...args)
      installLogger(this.axios, logFn)
    }

    // 2. Throttle (limits concurrency before requests are dispatched)
    if (throttleOpts?.maxConcurrent && throttleOpts.maxConcurrent > 0) {
      installThrottle(this.axios, new RequestThrottle(throttleOpts))
    }

    // 3. Tracker (assign ID & AbortController, lifecycle hooks)
    installTracker(this.axios, this.tracker)

    // 4. Cache (override adapter on hit — no network, response flows normally)
    if (cacheOpts?.ttl && cacheOpts.ttl > 0) {
      this.cacheManager = new CacheManager(cacheOpts)
      installCache(this.axios, this.cacheManager)
    }

    // 5. Cancel deduplication
    if (cancel?.deduplicate) {
      installCancel(this.axios)
    }

    // 6. Auth (token injection + 401 refresh)
    if (auth) {
      installAuth(this.axios, auth)
    }

    // 7. Retry (response error – retries before transform rejects)
    if (retry) {
      installRetry(this.axios, retry)
    }

    // 7.5. Tracker error cleanup (after retry — so entries stay alive during retry cycle)
    installTrackerCleanup(this.axios, this.tracker)

    // 8. Transform (unwraps data / checks business code)
    installTransform(this.axios, options)

    // 9. Error hook (must be last – catches all upstream errors)
    if (onError) {
      installErrorHook(this.axios, onError)
    }
  }

  // ---- Loading & Queue ---------------------------------------------------

  get loading(): boolean {
    return this.tracker.loading
  }

  get queue(): ReadonlyArray<RequestEntry> {
    return this.tracker.queue
  }

  // ---- Typed convenience methods ----------------------------------------

  async get<T = unknown>(url: string, config?: RequestOptions): Promise<ApiResponse<T>> {
    return this.axios.get(url, config) as Promise<ApiResponse<T>>
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.axios.post(url, data, config) as Promise<ApiResponse<T>>
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.axios.put(url, data, config) as Promise<ApiResponse<T>>
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.axios.patch(url, data, config) as Promise<ApiResponse<T>>
  }

  async delete<T = unknown>(url: string, config?: RequestOptions): Promise<ApiResponse<T>> {
    return this.axios.delete(url, config) as Promise<ApiResponse<T>>
  }

  async request<T = unknown>(config: RequestOptions): Promise<ApiResponse<T>> {
    return this.axios.request(config) as Promise<ApiResponse<T>>
  }

  // ---- Upload / Download ------------------------------------------------

  async upload<T = unknown>(
    url: string,
    data: FormData | Record<string, unknown>,
    config?: RequestOptions & { onProgress?: ProgressCallback },
  ): Promise<ApiResponse<T>> {
    const { onProgress, ...rest } = config ?? {}

    const formData = data instanceof FormData ? data : toFormData(data)

    return this.axios.post(url, formData, {
      ...rest,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...rest.headers,
      },
      onUploadProgress: onProgress
        ? (e) => {
            const total = e.total ?? 0
            const loaded = e.loaded ?? 0
            onProgress({
              loaded,
              total,
              percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            })
          }
        : undefined,
    }) as Promise<ApiResponse<T>>
  }

  async download(
    url: string,
    config?: RequestOptions & { onProgress?: ProgressCallback },
  ): Promise<AxiosResponse<Blob>> {
    const { onProgress, ...rest } = config ?? {}

    const cfg: RequestOptions = {
      ...rest,
      responseType: 'blob',
      responseTransform: false,
      onDownloadProgress: onProgress
        ? (e) => {
            const total = e.total ?? 0
            const loaded = e.loaded ?? 0
            onProgress({
              loaded,
              total,
              percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            })
          }
        : undefined,
    }
    return this.axios.get(url, cfg) as Promise<AxiosResponse<Blob>>
  }

  // ---- Interceptor registration -----------------------------------------

  onRequest(fn: RequestInterceptor, onError?: RequestErrorInterceptor): () => void {
    const id = this.axios.interceptors.request.use(fn, onError)
    return () => this.axios.interceptors.request.eject(id)
  }

  onResponse(fn: ResponseInterceptor, onError?: ResponseErrorInterceptor): () => void {
    const wrapper = (response: AxiosResponse): AxiosResponse | Promise<AxiosResponse> =>
      fn(response)
    const id = this.axios.interceptors.response.use(wrapper, onError)
    return () => this.axios.interceptors.response.eject(id)
  }

  // ---- Cancel ------------------------------------------------------------

  cancelAll(): void {
    this.tracker.cancelAll()
  }

  cancelGroup(group: string): void {
    this.tracker.cancelGroup(group)
  }

  cancelById(id: string): void {
    this.tracker.cancelById(id)
  }

  // ---- Cache -------------------------------------------------------------

  clearCache(): void {
    this.cacheManager?.clear()
  }

  // ---- Lifecycle ---------------------------------------------------------

  destroy(): void {
    this.tracker.cancelAll()
    this.cacheManager?.clear()
    this.axios.interceptors.request.clear()
    this.axios.interceptors.response.clear()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFormData(obj: Record<string, unknown>, parentKey?: string): FormData {
  const fd = new FormData()
  appendToFormData(fd, obj, parentKey)
  return fd
}

function appendToFormData(fd: FormData, data: unknown, parentKey?: string): void {
  if (data === null || data === undefined) return

  if (data instanceof Blob) {
    fd.append(parentKey ?? 'file', data)
  } else if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      appendToFormData(fd, data[i], parentKey ? `${parentKey}[${i}]` : `[${i}]`)
    }
  } else if (typeof data === 'object' && !(data instanceof Date)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const fullKey = parentKey ? `${parentKey}[${key}]` : key
      appendToFormData(fd, value, fullKey)
    }
  } else {
    fd.append(parentKey ?? '', String(data))
  }
}
