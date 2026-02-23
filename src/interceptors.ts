import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { CancelManager } from './cancel'
import { ZhiAxiosError, classifyError } from './errors'
import { ErrorType } from './types'
import type { AuthOptions, CreateAxiosOptions, InternalRequestConfig } from './types'

// ---------------------------------------------------------------------------
// Cancel interceptor
// ---------------------------------------------------------------------------

export function installCancel(instance: AxiosInstance): CancelManager {
  const manager = new CancelManager()

  instance.interceptors.request.use((config) => {
    const cfg = config as InternalRequestConfig
    if (!cfg._skipCancel) {
      manager.setup(config)
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      manager.remove(response.config)
      return response
    },
    (error: AxiosError) => {
      if (error.config) manager.remove(error.config)
      return Promise.reject(error)
    },
  )

  return manager
}

// ---------------------------------------------------------------------------
// Auth interceptor (token injection + 401 refresh)
// ---------------------------------------------------------------------------

export function installAuth(instance: AxiosInstance, auth: AuthOptions): void {
  const headerName = auth.headerName ?? 'Authorization'
  const prefix = auth.tokenPrefix ?? 'Bearer'

  let isRefreshing = false
  let pendingQueue: Array<{
    resolve: (token: string) => void
    reject: (err: unknown) => void
  }> = []

  function resolvePending(token: string) {
    for (const p of pendingQueue) p.resolve(token)
    pendingQueue = []
  }

  function rejectPending(err: unknown) {
    for (const p of pendingQueue) p.reject(err)
    pendingQueue = []
  }

  instance.interceptors.request.use(async (config) => {
    const token = await auth.getToken()
    if (token) {
      config.headers.set(headerName, `${prefix} ${token}`)
    }
    return config
  })

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const originalConfig = error.config as InternalRequestConfig | undefined
    if (!originalConfig || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    if (originalConfig._retried) {
      auth.onUnauthorized?.()
      return Promise.reject(error)
    }

    if (!auth.refreshToken) {
      auth.onUnauthorized?.()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            originalConfig.headers.set(headerName, `${prefix} ${token}`)
            originalConfig._retried = true
            resolve(instance.request(originalConfig))
          },
          reject,
        })
      })
    }

    isRefreshing = true
    originalConfig._retried = true

    try {
      const newToken = await auth.refreshToken()
      originalConfig.headers.set(headerName, `${prefix} ${newToken}`)
      resolvePending(newToken)
      return instance.request(originalConfig)
    } catch (refreshError) {
      rejectPending(refreshError)
      auth.onUnauthorized?.()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  })
}

// ---------------------------------------------------------------------------
// Business-code & transform interceptor (supports per-request overrides)
// ---------------------------------------------------------------------------

export function installTransform(instance: AxiosInstance, options: CreateAxiosOptions): void {
  const rawGlobal = options.successCode ?? 0
  const globalSuccessCodes = Array.isArray(rawGlobal) ? rawGlobal : [rawGlobal]

  instance.interceptors.response.use((response: AxiosResponse) => {
    // Auth retry resolves with already-transformed data via instance.request();
    // that data re-enters the original chain and has no `.config`.
    if (!response?.config) return response

    const cfg = response.config as InternalRequestConfig
    const data = response.data

    const transform =
      cfg.responseTransform !== undefined ? cfg.responseTransform : options.responseTransform

    if (transform === false) {
      return response
    }

    if (typeof transform === 'function') {
      return transform(response) as AxiosResponse
    }

    if (data && typeof data === 'object' && 'code' in data) {
      const rawPerReq = cfg.successCode
      const successCodes =
        rawPerReq !== undefined
          ? Array.isArray(rawPerReq)
            ? rawPerReq
            : [rawPerReq]
          : globalSuccessCodes

      // Coerce to number for comparison (handles string codes like "0")
      const code = Number(data.code)
      if (!successCodes.includes(code)) {
        const err = new ZhiAxiosError(
          ErrorType.Business,
          new Error(data.message || `Business error: code ${data.code}`),
          { businessCode: code, config: cfg },
        )
        return Promise.reject(err)
      }
    }

    return data
  })
}

// ---------------------------------------------------------------------------
// Global error hook (must be installed last)
// ---------------------------------------------------------------------------

/**
 * Installs a final response-error interceptor that calls the global `onError` hook.
 *
 * Return values from `onError`:
 * - `void` / `undefined`: error is re-thrown normally
 * - `false`: error is swallowed, promise resolves with `undefined`
 * - any other value: error is swallowed, promise resolves with that value (fallback data)
 */
export function installErrorHook(
  instance: AxiosInstance,
  onError: (
    error: AxiosError | Error,
    type: ErrorType,
    config?: AxiosRequestConfig,
  ) => undefined | false | unknown,
): void {
  instance.interceptors.response.use(undefined, (error: AxiosError | Error) => {
    const type = classifyError(error)
    const config = (error as AxiosError).config
    const result = onError(error, type, config)
    if (result === false) return Promise.resolve(undefined)
    if (result !== undefined) return Promise.resolve(result)
    return Promise.reject(error)
  })
}
