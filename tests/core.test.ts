import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createAxios, ZhiAxios } from '../src/index'

function mockAdapter(body: unknown) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({
      data: body,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse)
}

describe('createAxios', () => {
  it('should create a ZhiAxios instance', () => {
    const http = createAxios()
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should expose the underlying axios instance', () => {
    const http = createAxios({ baseURL: '/api' })
    expect(http.axios).toBeDefined()
    expect(http.axios.defaults.baseURL).toBe('/api')
  })

  it('should accept custom timeout', () => {
    const http = createAxios({ timeout: 5000 })
    expect(http.axios.defaults.timeout).toBe(5000)
  })

  it('should accept custom headers', () => {
    const http = createAxios({
      headers: { 'X-Custom': 'test' },
    })
    expect(http.axios.defaults.headers['X-Custom']).toBe('test')
  })

  it('should provide cancelAll method', () => {
    const http = createAxios()
    expect(typeof http.cancelAll).toBe('function')
    http.cancelAll()
  })

  it('should provide interceptor registration methods', () => {
    const http = createAxios()
    expect(typeof http.onRequest).toBe('function')
    expect(typeof http.onResponse).toBe('function')
  })

  it('onRequest should return a disposer function', () => {
    const http = createAxios()
    const dispose = http.onRequest((config) => config)
    expect(typeof dispose).toBe('function')
    dispose()
  })

  it('onResponse should return a disposer function', () => {
    const http = createAxios()
    const dispose = http.onResponse((response) => response)
    expect(typeof dispose).toBe('function')
    dispose()
  })
})

describe('ZhiAxios tracker integration', () => {
  it('should expose loading and queue properties', () => {
    const http = createAxios()
    expect(http.loading).toBe(false)
    expect(http.queue).toEqual([])
  })

  it('should provide cancelGroup and cancelById methods', () => {
    const http = createAxios()
    expect(typeof http.cancelGroup).toBe('function')
    expect(typeof http.cancelById).toBe('function')
  })

  it('should accept tracker hooks in options', () => {
    const onLoadingChange = vi.fn()
    const onQueueChange = vi.fn()
    const onRequestStart = vi.fn()
    const onRequestEnd = vi.fn()

    const http = createAxios({
      tracker: { onLoadingChange, onQueueChange, onRequestStart, onRequestEnd },
    })

    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept slow request hooks', () => {
    const onSlow = vi.fn()
    const http = createAxios({
      tracker: { slowThreshold: 5000, onSlowRequest: onSlow },
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })
})

describe('ZhiAxios new features', () => {
  it('should accept throttle option', () => {
    const http = createAxios({ throttle: { maxConcurrent: 5 } })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept cache option', () => {
    const http = createAxios({ cache: { ttl: 30000 } })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should provide clearCache method', () => {
    const http = createAxios({ cache: { ttl: 5000 } })
    expect(typeof http.clearCache).toBe('function')
    http.clearCache()
  })

  it('clearCache should be safe when cache is not configured', () => {
    const http = createAxios()
    expect(() => http.clearCache()).not.toThrow()
  })

  it('invalidateCache should return 0 when cache is not configured', () => {
    const http = createAxios()
    expect(http.invalidateCache(/.*/)).toBe(0)
  })

  it('should accept debug = true', () => {
    const http = createAxios({ debug: true })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept debug = custom function', () => {
    const logFn = vi.fn()
    const http = createAxios({ debug: logFn })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should provide upload method', () => {
    const http = createAxios()
    expect(typeof http.upload).toBe('function')
  })

  it('should provide download method', () => {
    const http = createAxios()
    expect(typeof http.download).toBe('function')
  })

  it('should accept onError with ErrorType', () => {
    const onError = vi.fn()
    const http = createAxios({ onError })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept retry with methods and shouldRetry', () => {
    const http = createAxios({
      retry: {
        count: 3,
        methods: ['GET', 'POST'],
        shouldRetry: (_error, count) => count < 2,
      },
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept requestInterceptors as functions', () => {
    const fn = vi.fn((config) => config)
    const http = createAxios({
      requestInterceptors: [fn],
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept requestInterceptors as objects', () => {
    const http = createAxios({
      requestInterceptors: [
        {
          fulfilled: (config) => config,
          rejected: (error) => Promise.reject(error),
        },
      ],
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept responseInterceptors as functions', () => {
    const fn = vi.fn((response) => response)
    const http = createAxios({
      responseInterceptors: [fn],
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept responseInterceptors as objects', () => {
    const http = createAxios({
      responseInterceptors: [
        {
          fulfilled: (response) => response,
          rejected: (error) => Promise.reject(error),
        },
      ],
    })
    expect(http).toBeInstanceOf(ZhiAxios)
  })

  it('should accept full configuration', () => {
    const http = createAxios({
      baseURL: '/api',
      timeout: 10000,
      cancel: { deduplicate: true },
      retry: { count: 2, methods: ['GET'] },
      auth: {
        getToken: () => 'token',
        refreshToken: async () => 'new-token',
        onUnauthorized: () => {},
      },
      tracker: {
        onLoadingChange: () => {},
        onQueueChange: () => {},
        slowThreshold: 10000,
        onSlowRequest: () => {},
      },
      throttle: { maxConcurrent: 6 },
      cache: { ttl: 30000, methods: ['GET'] },
      debug: true,
      successCode: [0, 200],
      onError: () => {},
    })
    expect(http).toBeInstanceOf(ZhiAxios)
    expect(http.axios.defaults.baseURL).toBe('/api')
    expect(http.axios.defaults.timeout).toBe(10000)
  })

  it('upload should convert object to FormData and call onProgress', async () => {
    let receivedData: unknown
    let progressCalled = false
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      receivedData = config.data
      if (config.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 100, bytes: 50 } as any)
      }
      return Promise.resolve({
        data: { code: 0, data: 'ok', message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({ adapter, successCode: [0] })
    await http.upload(
      '/upload',
      { name: 'test' },
      {
        onProgress: (e) => {
          progressCalled = true
          expect(e.percent).toBe(50)
        },
      },
    )
    expect(receivedData).toBeInstanceOf(FormData)
    expect(progressCalled).toBe(true)
  })

  it('upload should pass through existing FormData', async () => {
    let receivedData: unknown
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      receivedData = config.data
      return Promise.resolve({
        data: { code: 0, data: 'ok', message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const fd = new FormData()
    fd.append('file', new Blob(['hello']))
    const http = createAxios({ adapter, successCode: [0] })
    await http.upload('/upload', fd)
    expect(receivedData).toBe(fd)
  })

  it('download should call onProgress', async () => {
    let progressCalled = false
    const blob = new Blob(['data'])
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      if (config.onDownloadProgress) {
        config.onDownloadProgress({ loaded: 100, total: 100, bytes: 100 } as any)
      }
      return Promise.resolve({
        data: blob,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({ adapter })
    await http.download('/file', {
      onProgress: (e) => {
        progressCalled = true
        expect(e.percent).toBe(100)
      },
    })
    expect(progressCalled).toBe(true)
  })

  it('cancelGroup and cancelById should work', async () => {
    const http = createAxios({ adapter: mockAdapter({}) })
    http.cancelGroup('test-group')
    http.cancelById('test-id')
    expect(http.queue).toHaveLength(0)
  })

  it('clearCache should not throw without cache', () => {
    const http = createAxios({ adapter: mockAdapter({}) })
    expect(() => http.clearCache()).not.toThrow()
  })

  it('toFormData should handle nested objects, arrays, Blobs and Dates', async () => {
    let receivedData: FormData | undefined
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      receivedData = config.data as FormData
      return Promise.resolve({
        data: { code: 0, data: 'ok', message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const http = createAxios({ adapter, successCode: [0] })
    await http.upload('/upload', {
      name: 'test',
      tags: ['a', 'b'],
      nested: { x: 1 },
      file: new Blob(['hi']),
      date: new Date('2025-01-01'),
      empty: null,
    })

    expect(receivedData).toBeInstanceOf(FormData)
    expect(receivedData!.get('name')).toBe('test')
    expect(receivedData!.get('tags[0]')).toBe('a')
    expect(receivedData!.get('tags[1]')).toBe('b')
    expect(receivedData!.get('nested[x]')).toBe('1')
    expect(receivedData!.get('file')).toBeInstanceOf(Blob)
  })

  it('destroy should cancel requests, clear cache, and eject interceptors', async () => {
    const adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
      Promise.resolve({
        data: { code: 0, data: 'ok', message: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)

    const http = createAxios({
      adapter,
      successCode: [0],
      cache: { ttl: 60000 },
    })

    const res1 = await http.get('/cached')
    expect(res1).toEqual({ code: 0, data: 'ok', message: '' })
    expect(http.queue).toHaveLength(0)

    expect(() => http.destroy()).not.toThrow()

    // After destroy, interceptors are ejected so transform no longer unwraps
    const res2 = await http.get('/cached')
    expect(res2.data).toEqual({ code: 0, data: 'ok', message: '' })
    expect(res2.status).toBe(200)
  })

  it('destroy without optional features should not throw', () => {
    const http = createAxios({ adapter: mockAdapter({}) })
    expect(() => http.destroy()).not.toThrow()
  })
})
