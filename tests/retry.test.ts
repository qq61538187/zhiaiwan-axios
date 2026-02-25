import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios, { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installRetry } from '../src/retry'

function mockErrorAdapter(status: number) {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('Error', 'ERR', config, {}, {
        data: {},
        status,
        statusText: 'Error',
        headers: {},
        config,
      } as AxiosResponse),
    )
}

describe('installRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not install interceptor when count <= 0', () => {
    const instance = axios.create()
    const spy = vi.spyOn(instance.interceptors.response, 'use')
    installRetry(instance, { count: 0 })
    expect(spy).not.toHaveBeenCalled()
    installRetry(instance, {})
    expect(spy).not.toHaveBeenCalled()
  })

  it('should install interceptor when count > 0', () => {
    const instance = axios.create()
    const spy = vi.spyOn(instance.interceptors.response, 'use')
    installRetry(instance, { count: 3 })
    expect(spy).toHaveBeenCalledOnce()
  })

  it('should retry on 500 and eventually succeed', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount < 3) {
        return Promise.reject(
          new AxiosError('500', 'ERR', config, {}, {
            data: {},
            status: 500,
            statusText: 'Error',
            headers: {},
            config,
          } as AxiosResponse),
        )
      }
      return Promise.resolve({
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const instance = axios.create({ adapter })
    installRetry(instance, { count: 3, delay: 100 })

    const promise = instance.get('/api')
    // Advance timers for retries
    await vi.advanceTimersByTimeAsync(100) // 1st retry
    await vi.advanceTimersByTimeAsync(200) // 2nd retry

    const res = await promise
    expect(callCount).toBe(3)
    expect(res.data).toBe('ok')
  })

  it('should exhaust retries and reject', async () => {
    const instance = axios.create({ adapter: mockErrorAdapter(500) })
    installRetry(instance, { count: 2, delay: 50 })

    const promise = instance.get('/api').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(50) // 1st retry
    await vi.advanceTimersByTimeAsync(100) // 2nd retry

    const result = await promise
    expect(result).toBeInstanceOf(AxiosError)
  })

  it('should not retry when method is not in methods list', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      return Promise.reject(
        new AxiosError('500', 'ERR', config, {}, {
          data: {},
          status: 500,
          statusText: 'Error',
          headers: {},
          config,
        } as AxiosResponse),
      )
    }

    const instance = axios.create({ adapter })
    installRetry(instance, { count: 3, delay: 50, methods: ['GET'] })

    const result = await instance.post('/api', {}).catch((e: unknown) => e)
    expect(result).toBeInstanceOf(AxiosError)
    expect(callCount).toBe(1)
  })

  it('should not retry when status is not in statusCodes', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      return Promise.reject(
        new AxiosError('404', 'ERR', config, {}, {
          data: {},
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config,
        } as AxiosResponse),
      )
    }

    const instance = axios.create({ adapter })
    installRetry(instance, { count: 3, delay: 50, statusCodes: [500, 502] })

    const result = await instance.get('/api').catch((e: unknown) => e)
    expect(result).toBeInstanceOf(AxiosError)
    expect(callCount).toBe(1)
  })

  it('should use shouldRetry when provided', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      return Promise.reject(
        new AxiosError('500', 'ERR', config, {}, {
          data: {},
          status: 500,
          statusText: 'Error',
          headers: {},
          config,
        } as AxiosResponse),
      )
    }

    const shouldRetry = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const instance = axios.create({ adapter })
    installRetry(instance, { count: 5, delay: 50, shouldRetry })

    const promise = instance.get('/api').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(50)

    const result = await promise
    expect(result).toBeInstanceOf(AxiosError)
    expect(callCount).toBe(2)
    expect(shouldRetry).toHaveBeenCalledTimes(2)
  })

  it('should use per-request retry object override', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount < 3) {
        return Promise.reject(
          new AxiosError('500', 'ERR', config, {}, {
            data: {},
            status: 500,
            statusText: 'Error',
            headers: {},
            config,
          } as AxiosResponse),
        )
      }
      return Promise.resolve({
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const instance = axios.create({ adapter })
    installRetry(instance, { count: 1, delay: 100 })

    const config = { retry: { count: 5, delay: 50 } } as any
    const promise = instance.get('/api', config)
    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(100)

    const res = await promise
    expect(callCount).toBe(3)
    expect(res.data).toBe('ok')
  })

  it('should reject when error has no config', async () => {
    const instance = axios.create()
    installRetry(instance, { count: 3 })

    const error = new AxiosError('no config')
    instance.interceptors.response.use(undefined, () => Promise.reject(error))

    const result = await instance.get('/api').catch((e: unknown) => e)
    expect(result).toBe(error)
  })

  it('should cap backoff at maxDelay', async () => {
    let callCount = 0

    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount <= 4) {
        return Promise.reject(
          new AxiosError('500', 'ERR', config, {}, {
            data: {},
            status: 500,
            statusText: 'Error',
            headers: {},
            config,
          } as AxiosResponse),
        )
      }
      return Promise.resolve({
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const instance = axios.create({ adapter })
    installRetry(instance, { count: 5, delay: 1000, maxDelay: 3000 })

    const promise = instance.get('/api')
    // Backoff: 1000, 2000, 3000 (capped), 3000 (capped)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(3000)

    const res = await promise
    expect(callCount).toBe(5)
    expect(res.data).toBe('ok')
  })

  it('should abort retry if signal is aborted during sleep', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      return Promise.reject(
        new AxiosError('500', 'ERR', config, {}, {
          data: {},
          status: 500,
          statusText: 'Error',
          headers: {},
          config,
        } as AxiosResponse),
      )
    }

    const controller = new AbortController()
    const instance = axios.create({ adapter })
    installRetry(instance, { count: 3, delay: 5000 })

    const promise = instance.get('/api', { signal: controller.signal }).catch((e: unknown) => e)

    // First call fails, retry sleeps
    await vi.advanceTimersByTimeAsync(1000)
    // Abort while sleeping
    controller.abort()
    await vi.advanceTimersByTimeAsync(5000)

    const result = await promise
    expect(result).toBeInstanceOf(AxiosError)
    expect(callCount).toBe(1)
  })
})
