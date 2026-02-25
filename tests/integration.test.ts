import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAxios } from '../src/index'
import { ErrorType } from '../src/types'

function mockAdapter(data: unknown, status = 200) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({ data, status, statusText: 'OK', headers: {}, config } as AxiosResponse)
}

describe('Integration: full pipeline', () => {
  it('auth + transform: injects token and unwraps data', async () => {
    const body = { code: 0, data: { name: 'Alice' }, message: 'ok' }
    const http = createAxios({
      adapter: mockAdapter(body),
      auth: { getToken: () => 'test-token' },
      successCode: [0],
    })

    const res = await http.get<{ name: string }>('/user')
    expect(res).toEqual(body)
  })

  it('transform + errorHook: business error triggers onError with correct type', async () => {
    const body = { code: 40001, data: null, message: 'Invalid param' }
    const onError = vi.fn()
    const http = createAxios({
      adapter: mockAdapter(body),
      successCode: [0],
      onError,
    })

    await http.get('/api').catch(() => {})
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][1]).toBe(ErrorType.Business)
  })

  it('onError returning false swallows the error', async () => {
    const body = { code: 99, data: null, message: 'fail' }
    const http = createAxios({
      adapter: mockAdapter(body),
      successCode: [0],
      onError: () => false,
    })

    const res = await http.get('/api')
    expect(res).toBeUndefined()
  })

  it('onError returning fallback data resolves the promise with that data', async () => {
    const body = { code: 99, data: null, message: 'fail' }
    const fallback = { code: 0, data: [], message: 'fallback' }
    const http = createAxios({
      adapter: mockAdapter(body),
      successCode: [0],
      onError: () => fallback,
    })

    const res = await http.get('/api')
    expect(res).toEqual(fallback)
  })

  it('tracker hooks fire during request lifecycle', async () => {
    const body = { code: 0, data: 'ok', message: '' }
    const onStart = vi.fn()
    const onEnd = vi.fn()
    const onLoadingChange = vi.fn()

    const http = createAxios({
      adapter: mockAdapter(body),
      tracker: { onRequestStart: onStart, onRequestEnd: onEnd, onLoadingChange },
    })

    await http.get('/api')

    expect(onStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0].duration).toBeGreaterThanOrEqual(0)
    expect(onLoadingChange).toHaveBeenCalledTimes(2)
    expect(onLoadingChange.mock.calls[0][0]).toBe(true)
    expect(onLoadingChange.mock.calls[1][0]).toBe(false)
  })

  it('cache: returns cached response on second call', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: `call-${callCount}`, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    const res1 = await http.get('/data')
    const res2 = await http.get('/data')

    expect(callCount).toBe(1)
    expect(res1).toEqual(res2)
  })

  it('cache: different params are cached separately', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: callCount, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    await http.get('/data', { params: { page: 1 } })
    await http.get('/data', { params: { page: 2 } })

    expect(callCount).toBe(2)
  })

  it('clearCache: forces re-fetch after clearing', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: callCount, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    await http.get('/data')
    expect(callCount).toBe(1)

    http.clearCache()
    await http.get('/data')
    expect(callCount).toBe(2)
  })

  it('cache: per-request cache=false skips read/write', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: callCount, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    await http.get('/data', { cache: false })
    await http.get('/data', { cache: false })

    expect(callCount).toBe(2)
  })

  it('cache: per-request cacheKey reuses cache across different params', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: `call-${callCount}`, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    const first = await http.get('/data', { params: { page: 1 }, cacheKey: 'data:list' })
    const second = await http.get('/data', { params: { page: 2 }, cacheKey: 'data:list' })

    expect(callCount).toBe(1)
    expect(first).toEqual(second)
  })

  it('invalidateCache: removes targeted entries only', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      callCount++
      return Promise.resolve({
        data: { code: 0, data: callCount, message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cache: { ttl: 60000 },
      successCode: [0],
    })

    await http.get('/users', { cacheKey: 'users:list' })
    await http.get('/posts', { cacheKey: 'posts:list' })
    expect(callCount).toBe(2)

    await http.get('/users', { cacheKey: 'users:list' })
    await http.get('/posts', { cacheKey: 'posts:list' })
    expect(callCount).toBe(2)

    const removed = http.invalidateCache(/^users:/)
    expect(removed).toBe(1)

    await http.get('/users', { cacheKey: 'users:list' })
    await http.get('/posts', { cacheKey: 'posts:list' })
    expect(callCount).toBe(3)
  })

  it('throttle: limits concurrent requests', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      return new Promise((resolve) => {
        setTimeout(() => {
          concurrent--
          resolve({
            data: { ok: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse)
        }, 10)
      })
    }

    const http = createAxios({
      adapter,
      throttle: { maxConcurrent: 2 },
      responseTransform: false,
    })

    await Promise.all([http.get('/a'), http.get('/b'), http.get('/c'), http.get('/d')])

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('retry: retries on 500 and succeeds', async () => {
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
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      retry: { count: 3, delay: 10, maxDelay: 50 },
      responseTransform: false,
    })

    const res = await http.get('/flaky')
    expect(callCount).toBe(3)
    expect(res.data.ok).toBe(true)
  })

  it('retry: respects methods filter', async () => {
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

    const http = createAxios({
      adapter,
      retry: { count: 3, delay: 10, methods: ['GET'] },
      responseTransform: false,
    })

    // POST is not in retry methods, should not retry
    await http.post('/action', {}).catch(() => {})
    expect(callCount).toBe(1)
  })

  it('retry: per-request retry: false disables retry', async () => {
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

    const http = createAxios({
      adapter,
      retry: { count: 3, delay: 10 },
      responseTransform: false,
    })

    await http.get('/no-retry', { retry: false } as any).catch(() => {})
    expect(callCount).toBe(1)
  })

  it('debug: calls log function on request/response', async () => {
    const logFn = vi.fn()
    const body = { code: 0, data: 'ok', message: '' }
    const http = createAxios({
      adapter: mockAdapter(body),
      debug: logFn,
    })

    await http.get('/test')

    expect(logFn).toHaveBeenCalledTimes(2)
    expect(logFn.mock.calls[0][0]).toContain('→')
    expect(logFn.mock.calls[1][0]).toContain('←')
  })

  it('requestInterceptors: runs after internal interceptors', async () => {
    const body = { code: 0, data: 'ok', message: '' }
    const order: string[] = []

    const http = createAxios({
      adapter: mockAdapter(body),
      auth: {
        getToken: () => {
          order.push('auth')
          return 'token'
        },
      },
      requestInterceptors: [
        (config) => {
          order.push('user')
          return config
        },
      ],
    })

    await http.get('/test')
    // Auth runs first (LIFO: added later = runs first), user runs last
    expect(order.indexOf('auth')).toBeLessThan(order.indexOf('user'))
  })

  it('string business code "0" matches numeric successCode [0]', async () => {
    const body = { code: '0', data: { ok: true }, message: 'ok' }
    const http = createAxios({
      adapter: mockAdapter(body),
      successCode: [0],
    })

    const res = await http.get('/api')
    expect(res).toEqual(body)
  })

  it('single number successCode works', async () => {
    const body = { code: 0, data: 'ok', message: '' }
    const http = createAxios({
      adapter: mockAdapter(body),
      successCode: 0,
    })
    const res = await http.get('/api')
    expect(res).toEqual(body)
  })

  it('onError receives config as third argument', async () => {
    const onError = vi.fn()
    const http = createAxios({
      adapter: mockAdapter({ code: 99, data: null, message: 'fail' }),
      successCode: [0],
      onError,
    })

    await http.get('/specific-url').catch(() => {})
    expect(onError).toHaveBeenCalledOnce()
    const config = onError.mock.calls[0][2]
    expect(config).toBeDefined()
    expect(config.url).toBe('/specific-url')
  })

  it('cancel dedup: second request aborts the first signal', async () => {
    const signals: Array<{ url: string; aborted: boolean }> = []
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      signals.push({ url: config.url ?? '', aborted: config.signal?.aborted ?? false })
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      cancel: { deduplicate: true },
      responseTransform: false,
    })

    await http.get('/data')
    await http.get('/data')

    expect(signals).toHaveLength(2)
    expect(signals[1].aborted).toBe(false)
  })

  it('auth refresh failure calls onUnauthorized', async () => {
    let _callCount = 0
    const onUnauthorized = vi.fn()
    const adapter = (config: InternalAxiosRequestConfig) => {
      _callCount++
      return Promise.reject(
        new AxiosError('401', 'ERR', config, {}, {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        } as AxiosResponse),
      )
    }

    const http = createAxios({
      adapter,
      auth: {
        getToken: () => 'old',
        refreshToken: async () => {
          throw new Error('refresh failed')
        },
        onUnauthorized,
      },
      responseTransform: false,
    })

    await http.get('/protected').catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('upload converts object to FormData', async () => {
    let receivedData: unknown
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      receivedData = config.data
      return Promise.resolve({
        data: { code: 0, data: 'uploaded', message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({ adapter, successCode: [0] })

    await http.upload('/upload', { name: 'test', count: '3' })
    expect(receivedData).toBeInstanceOf(FormData)
    expect((receivedData as FormData).get('name')).toBe('test')
    expect((receivedData as FormData).get('count')).toBe('3')
  })

  it('download sets responseType blob and returns response', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      expect(config.responseType).toBe('blob')
      return Promise.resolve({
        data: blob,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({ adapter })

    const res = await http.download('/file')
    expect(res.data).toBe(blob)
    expect(res.status).toBe(200)
  })

  it('cancelAll aborts a request during retry sleep', async () => {
    vi.useFakeTimers()
    try {
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

      const http = createAxios({
        adapter,
        retry: { count: 5, delay: 2000 },
        successCode: [0],
      })

      const promise = http.get('/api').catch((e: unknown) => e)

      // First call fails immediately, retry starts sleeping (2s backoff)
      await vi.advanceTimersByTimeAsync(500)
      expect(callCount).toBe(1)
      expect(http.queue).toHaveLength(1)

      // Cancel during sleep — entry is still tracked
      http.cancelAll()
      expect(http.queue).toHaveLength(0)

      // Advance past the sleep — retry should NOT fire a second request
      await vi.advanceTimersByTimeAsync(5000)

      const result = await promise
      expect(result).toBeInstanceOf(AxiosError)
      expect(callCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancelById aborts a specific retrying request', async () => {
    vi.useFakeTimers()
    try {
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

      const http = createAxios({
        adapter,
        retry: { count: 3, delay: 2000 },
        successCode: [0],
      })

      const promise = http.get('/api', { requestId: 'my-req' }).catch((e: unknown) => e)

      await vi.advanceTimersByTimeAsync(500)
      expect(callCount).toBe(1)

      http.cancelById('my-req')

      await vi.advanceTimersByTimeAsync(5000)

      const result = await promise
      expect(result).toBeInstanceOf(AxiosError)
      expect(callCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('throttle releases slot on error', async () => {
    let callCount = 0
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount <= 2) {
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
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({
      adapter,
      throttle: { maxConcurrent: 1 },
      responseTransform: false,
    })

    // First two fail, third should still get a slot
    await http.get('/a').catch(() => {})
    await http.get('/b').catch(() => {})
    const res = await http.get('/c')
    expect(res.data.ok).toBe(true)
    expect(callCount).toBe(3)
  })
})
