import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { installLogger } from '../src/logger'

function mockAdapter(data: unknown) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
}

describe('installLogger', () => {
  it('should log request and response', async () => {
    const log = vi.fn()
    const instance = axios.create({ adapter: mockAdapter({ ok: true }) })
    installLogger(instance, log)

    await instance.get('/api/data', { params: { page: 1 } })

    expect(log).toHaveBeenCalledTimes(2)

    const reqLog = log.mock.calls[0][0] as string
    expect(reqLog).toContain('→')
    expect(reqLog).toContain('GET')
    expect(reqLog).toContain('/api/data')

    const resLog = log.mock.calls[1][0] as string
    expect(resLog).toContain('←')
    expect(resLog).toContain('200')
    expect(resLog).toMatch(/\[\d+ms\]/)
  })

  it('should log error responses', async () => {
    const log = vi.fn()
    const instance = axios.create({
      adapter: () =>
        Promise.reject(
          new axios.AxiosError('fail', 'ERR', undefined, {}, {
            data: {},
            status: 500,
            statusText: 'Error',
            headers: {},
            config: { headers: new axios.AxiosHeaders() },
          } as any),
        ),
    })
    installLogger(instance, log)

    await instance.get('/fail').catch(() => {})

    expect(log).toHaveBeenCalledTimes(2)
    const errLog = log.mock.calls[1][0] as string
    expect(errLog).toContain('500')
  })
})
