import type { AxiosHeaders, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { RequestThrottle } from '../src/throttle'

function createConfig(url: string): InternalAxiosRequestConfig {
  return { url, method: 'GET', headers: {} as AxiosHeaders } as InternalAxiosRequestConfig
}

describe('RequestThrottle', () => {
  it('should allow requests immediately under the limit', () => {
    const throttle = new RequestThrottle({ maxConcurrent: 3 })
    const result = throttle.acquire(createConfig('/a'))
    expect(result).not.toBeInstanceOf(Promise)
  })

  it('should queue requests when maxConcurrent is reached', async () => {
    const throttle = new RequestThrottle({ maxConcurrent: 2 })

    throttle.acquire(createConfig('/a'))
    throttle.acquire(createConfig('/b'))

    const p = throttle.acquire(createConfig('/c'))
    expect(p).toBeInstanceOf(Promise)
    expect(throttle.pending).toBe(1)

    throttle.release()
    const resolved = await p
    expect(resolved.url).toBe('/c')
    expect(throttle.pending).toBe(0)
  })

  it('should process queue in FIFO order', async () => {
    const throttle = new RequestThrottle({ maxConcurrent: 1 })
    const order: string[] = []

    throttle.acquire(createConfig('/first'))

    const p2 = throttle.acquire(createConfig('/second')) as Promise<InternalAxiosRequestConfig>
    const p3 = throttle.acquire(createConfig('/third')) as Promise<InternalAxiosRequestConfig>

    p2.then((c) => order.push(c.url!))
    p3.then((c) => order.push(c.url!))

    throttle.release() // releases /first, dispatches /second
    await p2

    throttle.release() // releases /second, dispatches /third
    await p3

    expect(order).toEqual(['/second', '/third'])
  })

  it('should not go below zero active count', () => {
    const throttle = new RequestThrottle({ maxConcurrent: 2 })
    throttle.release()
    throttle.release()
    throttle.release()

    const result = throttle.acquire(createConfig('/a'))
    expect(result).not.toBeInstanceOf(Promise)
  })

  it('should default to Infinity when maxConcurrent is not set', () => {
    const throttle = new RequestThrottle({})
    for (let i = 0; i < 100; i++) {
      const result = throttle.acquire(createConfig(`/${i}`))
      expect(result).not.toBeInstanceOf(Promise)
    }
    expect(throttle.pending).toBe(0)
  })
})
