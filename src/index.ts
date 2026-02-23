import { ZhiAxios } from './core'
import type { CreateAxiosOptions, ZhiAxiosInstance } from './types'

export { ZhiAxios } from './core'
export const version: string = ZhiAxios.version
export { CancelManager } from './cancel'
export { RequestTracker } from './tracker'
export { RequestThrottle } from './throttle'
export { CacheManager } from './cache'
export { ZhiAxiosError, classifyError } from './errors'
export { ErrorType } from './types'

export type {
  ApiResponse,
  AuthOptions,
  CacheOptions,
  CancelOptions,
  CreateAxiosOptions,
  ExtendedRequestConfig,
  ProgressCallback,
  RequestEntry,
  RequestErrorInterceptor,
  RequestInterceptor,
  RequestInterceptorConfig,
  RequestOptions,
  ResponseErrorInterceptor,
  ResponseInterceptor,
  ResponseInterceptorConfig,
  RetryOptions,
  ThrottleOptions,
  TrackerHooks,
  ZhiAxiosInstance,
} from './types'

export type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

/**
 * Factory function – the recommended way to create an instance.
 *
 * @example
 * ```ts
 * import { createAxios } from '@zhiaiwan/axios'
 *
 * const http = createAxios({
 *   baseURL: '/api',
 *   timeout: 15000,
 *   cancel: { deduplicate: true },
 *   retry: { count: 3, methods: ['GET', 'PUT'], maxDelay: 10000 },
 *   auth: {
 *     getToken: () => localStorage.getItem('token'),
 *     refreshToken: async () => refreshApi(),
 *     onUnauthorized: () => router.push('/login'),
 *   },
 *   tracker: {
 *     onLoadingChange: (loading) => store.setGlobalLoading(loading),
 *     onQueueChange: (queue) => console.log('pending:', queue.length),
 *     slowThreshold: 10000,
 *     onSlowRequest: (entry) => console.warn('slow:', entry.url),
 *   },
 *   throttle: { maxConcurrent: 6 },
 *   cache: { ttl: 30000, methods: ['GET'] },
 *   debug: true,
 *   onError: (error, type) => {
 *     console.error(`[${type}]`, error.message)
 *   },
 * })
 * ```
 */
export function createAxios(options: CreateAxiosOptions = {}): ZhiAxiosInstance {
  return new ZhiAxios(options)
}
