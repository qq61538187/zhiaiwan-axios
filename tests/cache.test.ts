import type { AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheManager } from '../src/cache'
import type { ExtendedRequestConfig } from '../src/types'

function createConfig(
  method: string,
  url: string,
  extra: Partial<ExtendedRequestConfig> = {},
): ExtendedRequestConfig {
  return { method, url, headers: {} as AxiosHeaders, ...extra } as ExtendedRequestConfig
}

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new CacheManager({ ttl: 5000, methods: ['GET'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should cache and return GET responses', () => {
    const config = createConfig('GET', '/users')
    cache.set(config, { users: [] })

    const result = cache.get(config)
    expect(result).toEqual({ users: [] })
  })

  it('should not cache non-GET methods by default', () => {
    const config = createConfig('POST', '/users')
    cache.set(config, { created: true })

    expect(cache.get(config)).toBeUndefined()
  })

  it('should expire entries after TTL', () => {
    const config = createConfig('GET', '/data')
    cache.set(config, 'fresh')

    vi.advanceTimersByTime(4999)
    expect(cache.get(config)).toBe('fresh')

    vi.advanceTimersByTime(2)
    expect(cache.get(config)).toBeUndefined()
  })

  it('should differentiate by params', () => {
    const config1 = createConfig('GET', '/search', { params: { q: 'a' } })
    const config2 = createConfig('GET', '/search', { params: { q: 'b' } })

    cache.set(config1, 'result-a')
    cache.set(config2, 'result-b')

    expect(cache.get(config1)).toBe('result-a')
    expect(cache.get(config2)).toBe('result-b')
  })

  it('should skip cache when _skipCache is true', () => {
    const config = createConfig('GET', '/users', { _skipCache: true })
    cache.set(config, 'data')
    expect(cache.get(config)).toBeUndefined()
  })

  it('should clear all entries', () => {
    cache.set(createConfig('GET', '/a'), 'a')
    cache.set(createConfig('GET', '/b'), 'b')
    expect(cache.size).toBe(2)

    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('should support custom methods', () => {
    const customCache = new CacheManager({ ttl: 5000, methods: ['GET', 'POST'] })
    const config = createConfig('POST', '/api')
    customCache.set(config, 'cached-post')
    expect(customCache.get(config)).toBe('cached-post')
  })
})
