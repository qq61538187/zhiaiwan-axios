import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZhiAxiosError } from '../src/errors'
import { installAuth, installErrorHook, installTransform } from '../src/interceptors'
import { ErrorType } from '../src/types'

function mockAdapter(data: unknown, status = 200) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({ data, status, statusText: 'OK', headers: {}, config } as AxiosResponse)
}

function mockErrorAdapter(status: number) {
  return (config: InternalAxiosRequestConfig): Promise<never> => {
    const error = new AxiosError(`Error ${status}`, 'ERR_BAD_RESPONSE', config, {}, {
      data: {},
      status,
      statusText: 'Error',
      headers: {},
      config,
    } as AxiosResponse)
    return Promise.reject(error)
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('installAuth', () => {
  it('should inject token into request headers', async () => {
    const instance = axios.create({ adapter: mockAdapter({ ok: true }) })
    installAuth(instance, {
      getToken: () => 'my-token',
    })
    const res = await instance.get('/test')
    expect(res.config.headers.get('Authorization')).toBe('Bearer my-token')
  })

  it('should not inject header when getToken returns null', async () => {
    const instance = axios.create({ adapter: mockAdapter({ ok: true }) })
    installAuth(instance, { getToken: () => null })
    const res = await instance.get('/test')
    expect(res.config.headers.has('Authorization')).toBe(false)
  })

  it('should support async getToken', async () => {
    const instance = axios.create({ adapter: mockAdapter({ ok: true }) })
    installAuth(instance, {
      getToken: async () => 'async-token',
    })
    const res = await instance.get('/test')
    expect(res.config.headers.get('Authorization')).toBe('Bearer async-token')
  })

  it('should use custom headerName and tokenPrefix', async () => {
    const instance = axios.create({ adapter: mockAdapter({ ok: true }) })
    installAuth(instance, {
      getToken: () => 'tok',
      headerName: 'X-Token',
      tokenPrefix: 'Token',
    })
    const res = await instance.get('/test')
    expect(res.config.headers.get('X-Token')).toBe('Token tok')
  })

  it('should call onUnauthorized on 401 without refreshToken', async () => {
    const onUnauthorized = vi.fn()
    const instance = axios.create({ adapter: mockErrorAdapter(401) })
    installAuth(instance, {
      getToken: () => 'old-token',
      onUnauthorized,
    })

    await expect(instance.get('/protected')).rejects.toThrow()
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('should refresh token on 401 and retry', async () => {
    let callCount = 0
    let currentToken = 'old-token'
    const adapter = (config: InternalAxiosRequestConfig) => {
      callCount++
      if (callCount === 1) {
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
      return Promise.resolve({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    const instance = axios.create({ adapter })
    installAuth(instance, {
      getToken: () => currentToken,
      refreshToken: async () => {
        currentToken = 'new-token'
        return currentToken
      },
    })

    const res = await instance.get('/protected')
    expect(callCount).toBe(2)
    expect(res.data.success).toBe(true)
    expect(res.config.headers.get('Authorization')).toBe('Bearer new-token')
  })
})

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

describe('installTransform', () => {
  it('should unwrap response.data by default', async () => {
    const body = { code: 0, data: { name: 'John' }, message: 'ok' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, {})

    const res = await instance.get('/user')
    expect(res).toEqual(body)
  })

  it('should reject when business code does not match', async () => {
    const body = { code: 40001, data: null, message: 'Not found' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { successCode: [0] })

    await expect(instance.get('/user')).rejects.toThrow(ZhiAxiosError)

    try {
      await instance.get('/user')
    } catch (err) {
      expect(err).toBeInstanceOf(ZhiAxiosError)
      expect((err as ZhiAxiosError).type).toBe(ErrorType.Business)
      expect((err as ZhiAxiosError).businessCode).toBe(40001)
    }
  })

  it('should handle string business code via Number coercion', async () => {
    const body = { code: '0', data: { ok: true }, message: 'ok' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { successCode: [0] })

    const res = await instance.get('/api')
    expect(res).toEqual(body)
  })

  it('should reject string code that does not match', async () => {
    const body = { code: '500', data: null, message: 'fail' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { successCode: [0, 200] })

    await expect(instance.get('/api')).rejects.toThrow(ZhiAxiosError)
  })

  it('should support multiple successCode values', async () => {
    const body = { code: 200, data: 'ok', message: '' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { successCode: [0, 200] })

    const res = await instance.get('/api')
    expect(res).toEqual(body)
  })

  it('should return full response when responseTransform is false', async () => {
    const body = { code: 0, data: 'hello', message: 'ok' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { responseTransform: false })

    const res = await instance.get('/api')
    expect(res.data).toEqual(body)
    expect(res.status).toBe(200)
  })

  it('should apply custom responseTransform function', async () => {
    const body = { result: { items: [1, 2, 3] } }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, {
      responseTransform: (response) => response.data.result,
    })

    const res = await instance.get('/api')
    expect(res).toEqual({ items: [1, 2, 3] })
  })

  it('should support per-request successCode override', async () => {
    const body = { code: 1, data: 'legacy', message: 'ok' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, { successCode: [0] })

    // Global code 0 → code 1 would fail
    await expect(instance.get('/legacy')).rejects.toThrow()

    // Per-request override
    const res = await instance.get('/legacy', { successCode: [1] } as any)
    expect(res).toEqual(body)
  })

  it('should support per-request responseTransform override', async () => {
    const body = { code: 0, data: 'hello', message: 'ok' }
    const instance = axios.create({ adapter: mockAdapter(body) })
    installTransform(instance, {})

    // Per-request: disable transform
    const res = await instance.get('/api', { responseTransform: false } as any)
    expect(res.data).toEqual(body)
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// ErrorHook
// ---------------------------------------------------------------------------

describe('installErrorHook', () => {
  it('should call onError with error and type on failure', async () => {
    const onError = vi.fn()
    const instance = axios.create({ adapter: mockErrorAdapter(500) })
    installErrorHook(instance, onError)

    await expect(instance.get('/fail')).rejects.toThrow()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][1]).toBe(ErrorType.Http)
  })

  it('should swallow error when onError returns false', async () => {
    const instance = axios.create({ adapter: mockErrorAdapter(500) })
    installErrorHook(instance, () => false)

    const res = await instance.get('/fail')
    expect(res).toBeUndefined()
  })

  it('should re-throw when onError returns void', async () => {
    const instance = axios.create({ adapter: mockErrorAdapter(404) })
    installErrorHook(instance, () => {})

    await expect(instance.get('/fail')).rejects.toThrow()
  })

  it('should resolve with fallback data when onError returns a value', async () => {
    const fallback = { code: 0, data: [], message: 'fallback' }
    const instance = axios.create({ adapter: mockErrorAdapter(500) })
    installErrorHook(instance, () => fallback)

    const res = await instance.get('/fail')
    expect(res).toEqual(fallback)
  })
})
