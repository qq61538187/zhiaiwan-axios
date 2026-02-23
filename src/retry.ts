import type { AxiosError, AxiosInstance } from 'axios'
import type { InternalRequestConfig, RetryOptions } from './types'

const DEFAULT_STATUS_CODES = [408, 500, 502, 503, 504]
const DEFAULT_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']
const DEFAULT_MAX_DELAY = 30_000

interface NormalizedRetryOptions {
  count: number
  delay: number
  maxDelay: number
  statusCodes: number[]
  methods: string[]
  shouldRetry?: (error: AxiosError, retryCount: number) => boolean
}

function canRetry(error: AxiosError, opts: NormalizedRetryOptions): boolean {
  if (!error.config) return false
  const cfg = error.config as InternalRequestConfig
  const currentCount = cfg._retryCount ?? 0
  if (currentCount >= opts.count) return false

  if (opts.shouldRetry) {
    return opts.shouldRetry(error, currentCount)
  }

  const method = (cfg.method ?? 'GET').toUpperCase()
  if (!opts.methods.includes(method)) return false

  if (!error.response) return true

  return opts.statusCodes.includes(error.response.status)
}

function computeBackoff(delay: number, retryCount: number, maxDelay: number): number {
  return Math.min(delay * 2 ** (retryCount - 1), maxDelay)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Installs a response-error interceptor that retries failed requests
 * with exponential backoff (capped by maxDelay).
 */
export function installRetry(instance: AxiosInstance, options: RetryOptions): void {
  const opts: NormalizedRetryOptions = {
    count: options.count ?? 0,
    delay: options.delay ?? 1000,
    maxDelay: options.maxDelay ?? DEFAULT_MAX_DELAY,
    statusCodes: options.statusCodes ?? DEFAULT_STATUS_CODES,
    methods: (options.methods ?? DEFAULT_METHODS).map((m) => m.toUpperCase()),
    shouldRetry: options.shouldRetry,
  }

  if (opts.count <= 0) return

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const cfg = error.config as InternalRequestConfig | undefined

    if (cfg) {
      // Per-request retry override
      if (cfg.retry === false) return Promise.reject(error)
      if (cfg.retry && typeof cfg.retry === 'object') {
        const perReq: NormalizedRetryOptions = {
          count: cfg.retry.count ?? opts.count,
          delay: cfg.retry.delay ?? opts.delay,
          maxDelay: cfg.retry.maxDelay ?? opts.maxDelay,
          statusCodes: cfg.retry.statusCodes ?? opts.statusCodes,
          methods: (cfg.retry.methods ?? opts.methods).map((m) => m.toUpperCase()),
          shouldRetry: cfg.retry.shouldRetry ?? opts.shouldRetry,
        }
        if (!canRetry(error, perReq)) return Promise.reject(error)
        cfg._retryCount = (cfg._retryCount ?? 0) + 1
        await sleep(computeBackoff(perReq.delay, cfg._retryCount, perReq.maxDelay))
        if (cfg.signal?.aborted) return Promise.reject(error)
        cfg._skipCancel = true
        return instance.request(cfg)
      }

      // Global retry
      if (!canRetry(error, opts)) return Promise.reject(error)
      cfg._retryCount = (cfg._retryCount ?? 0) + 1
      await sleep(computeBackoff(opts.delay, cfg._retryCount, opts.maxDelay))
      if (cfg.signal?.aborted) return Promise.reject(error)
      cfg._skipCancel = true
      return instance.request(cfg)
    }

    return Promise.reject(error)
  })
}
