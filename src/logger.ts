import type { AxiosError, AxiosInstance } from 'axios'

type LogFn = (msg: string, ...args: unknown[]) => void

/**
 * Installs request/response logging interceptors.
 * Logs method, URL, status, and duration for every request.
 */
export function installLogger(instance: AxiosInstance, log: LogFn): void {
  instance.interceptors.request.use((config) => {
    const method = (config.method ?? 'GET').toUpperCase()
    log(`→ ${method} ${config.url}`, { params: config.params, data: config.data })
    ;(config as unknown as Record<string, unknown>).__logStart = Date.now()
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      const start = (response.config as unknown as Record<string, unknown>).__logStart as
        | number
        | undefined
      const duration = start ? `${Date.now() - start}ms` : '?ms'
      const method = (response.config.method ?? 'GET').toUpperCase()
      log(`← ${response.status} ${method} ${response.config.url} [${duration}]`)
      return response
    },
    (error: AxiosError) => {
      const cfg = error.config as unknown as Record<string, unknown> | undefined
      const start = cfg?.__logStart as number | undefined
      const duration = start ? `${Date.now() - start}ms` : '?ms'
      const method = (error.config?.method ?? 'GET').toUpperCase()
      const status = error.response?.status ?? 'ERR'
      log(`← ${status} ${method} ${error.config?.url} [${duration}]`, { message: error.message })
      return Promise.reject(error)
    },
  )
}
