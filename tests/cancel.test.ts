import type { AxiosHeaders, InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'
import { CancelManager } from '../src/cancel'

function createConfig(method: string, url: string): InternalAxiosRequestConfig {
  return {
    method,
    url,
    headers: {} as AxiosHeaders,
  } as InternalAxiosRequestConfig
}

describe('CancelManager', () => {
  let manager: CancelManager

  beforeEach(() => {
    manager = new CancelManager()
  })

  it('should attach AbortController signal to config', () => {
    const config = createConfig('GET', '/users')
    manager.setup(config)

    expect(config.signal).toBeInstanceOf(AbortSignal)
    expect(config.signal!.aborted).toBe(false)
  })

  it('should abort prior duplicate request', () => {
    const first = createConfig('GET', '/users')
    const second = createConfig('GET', '/users')

    manager.setup(first)
    manager.setup(second)

    expect(first.signal!.aborted).toBe(true)
    expect(second.signal!.aborted).toBe(false)
  })

  it('should not conflict between different method+url combinations', () => {
    const get = createConfig('GET', '/users')
    const post = createConfig('POST', '/users')

    manager.setup(get)
    manager.setup(post)

    expect(get.signal!.aborted).toBe(false)
    expect(post.signal!.aborted).toBe(false)
  })

  it('should remove entry after request completes', () => {
    const config = createConfig('GET', '/users')
    manager.setup(config)
    manager.remove(config)

    const next = createConfig('GET', '/users')
    manager.setup(next)

    expect(config.signal!.aborted).toBe(false)
    expect(next.signal!.aborted).toBe(false)
  })

  it('should abort all pending requests with cancelAll()', () => {
    const a = createConfig('GET', '/a')
    const b = createConfig('POST', '/b')

    manager.setup(a)
    manager.setup(b)
    manager.cancelAll()

    expect(a.signal!.aborted).toBe(true)
    expect(b.signal!.aborted).toBe(true)
  })
})
