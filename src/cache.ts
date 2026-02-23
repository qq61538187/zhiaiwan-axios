import type { AxiosInstance, AxiosResponse } from 'axios'
import type { CacheOptions, ExtendedRequestConfig, InternalRequestConfig } from './types'

interface CacheEntry {
  data: unknown
  expireAt: number
}

/**
 * Sort object keys recursively for stable JSON serialization.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  const sorted = Object.keys(obj as Record<string, unknown>).sort()
  const entries = sorted.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`,
  )
  return `{${entries.join(',')}}`
}

/**
 * In-memory response cache with TTL.
 * Only caches specified HTTP methods (default: GET).
 */
export class CacheManager {
  private store = new Map<string, CacheEntry>()
  private ttl: number
  private methods: Set<string>

  constructor(options: CacheOptions) {
    this.ttl = options.ttl ?? 0
    this.methods = new Set((options.methods ?? ['GET']).map((m) => m.toUpperCase()))
  }

  private getKey(config: ExtendedRequestConfig): string {
    const method = (config.method ?? 'GET').toUpperCase()
    const url = config.url ?? ''
    const params = config.params ? stableStringify(config.params) : ''
    return `${method}&${url}${params ? `?${params}` : ''}`
  }

  private shouldCache(config: ExtendedRequestConfig): boolean {
    if ((config as InternalRequestConfig)._skipCache) return false
    const method = (config.method ?? 'GET').toUpperCase()
    return this.methods.has(method)
  }

  get(config: ExtendedRequestConfig): unknown | undefined {
    if (!this.shouldCache(config)) return undefined
    const key = this.getKey(config)
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expireAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.data
  }

  set(config: ExtendedRequestConfig, data: unknown): void {
    if (!this.shouldCache(config)) return
    const key = this.getKey(config)
    this.store.set(key, { data, expireAt: Date.now() + this.ttl })
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

/**
 * Installs cache as request + response interceptors.
 * On cache hit, overrides `config.adapter` to return cached data
 * without hitting the network. Response flows through the normal
 * interceptor chain (including transform).
 */
export function installCache(instance: AxiosInstance, cache: CacheManager): void {
  instance.interceptors.request.use((config) => {
    const cfg = config as InternalRequestConfig
    const cached = cache.get(cfg)
    if (cached !== undefined) {
      cfg._fromCache = true
      cfg.adapter = (): Promise<AxiosResponse> =>
        Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse)
    }
    return config
  })

  instance.interceptors.response.use((response) => {
    const cfg = response.config as InternalRequestConfig
    if (!cfg._fromCache) {
      cache.set(cfg, response.data)
    }
    return response
  })
}
