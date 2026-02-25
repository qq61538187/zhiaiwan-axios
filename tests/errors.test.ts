import axios, { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { classifyError, ZhiAxiosError } from '../src/errors'
import { ErrorType } from '../src/types'

function makeAxiosError(overrides: {
  code?: string
  message?: string
  status?: number
  hasResponse?: boolean
}): AxiosError {
  const error = new AxiosError(
    overrides.message ?? 'test error',
    overrides.code,
    { headers: new AxiosHeaders() } as any,
    {},
    overrides.hasResponse !== false
      ? {
          status: overrides.status ?? 500,
          data: {},
          headers: {},
          statusText: 'Error',
          config: { headers: new AxiosHeaders() },
        }
      : undefined,
  )
  return error
}

describe('classifyError', () => {
  it('should classify timeout errors', () => {
    const error = makeAxiosError({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' })
    expect(classifyError(error)).toBe(ErrorType.Timeout)
  })

  it('should classify network errors (no response)', () => {
    const error = makeAxiosError({ hasResponse: false, code: 'ERR_NETWORK' })
    expect(classifyError(error)).toBe(ErrorType.Network)
  })

  it('should classify HTTP errors', () => {
    const error = makeAxiosError({ status: 404 })
    expect(classifyError(error)).toBe(ErrorType.Http)
  })

  it('should classify cancelled requests', () => {
    const error = new axios.CanceledError('cancelled')
    expect(classifyError(error)).toBe(ErrorType.Cancel)
  })

  it('should classify ETIMEDOUT as timeout', () => {
    const error = makeAxiosError({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' })
    expect(classifyError(error)).toBe(ErrorType.Timeout)
  })

  it('should classify timeout by message (case-insensitive)', () => {
    const error = makeAxiosError({ code: 'ERR_SOMETHING', message: 'Request Timeout exceeded' })
    expect(classifyError(error)).toBe(ErrorType.Timeout)
  })

  it('should classify unknown errors', () => {
    expect(classifyError(new Error('something'))).toBe(ErrorType.Unknown)
    expect(classifyError('string error')).toBe(ErrorType.Unknown)
  })

  it('should return existing type from ZhiAxiosError', () => {
    const err = new ZhiAxiosError(ErrorType.Business, new Error('biz'), { businessCode: 10001 })
    expect(classifyError(err)).toBe(ErrorType.Business)
  })
})

describe('ZhiAxiosError', () => {
  it('should carry type, raw error, and extra info', () => {
    const raw = new Error('order failed')
    const err = new ZhiAxiosError(ErrorType.Business, raw, {
      businessCode: 40001,
      status: 200,
    })

    expect(err.name).toBe('ZhiAxiosError')
    expect(err.message).toBe('order failed')
    expect(err.type).toBe(ErrorType.Business)
    expect(err.raw).toBe(raw)
    expect(err.businessCode).toBe(40001)
    expect(err.status).toBe(200)
  })

  it('should inherit config from AxiosError', () => {
    const axErr = makeAxiosError({ status: 500 })
    const err = new ZhiAxiosError(ErrorType.Http, axErr)
    expect(err.config).toBe(axErr.config)
  })
})
