import axios from 'axios'
import type { AxiosError, AxiosRequestConfig } from 'axios'
import { ErrorType } from './types'

/**
 * Typed wrapper that adds `type: ErrorType` to any request error,
 * allowing consumers to branch on error category without guessing.
 */
export class ZhiAxiosError extends Error {
  /** Classified error type. */
  readonly type: ErrorType
  /** The underlying Axios error (if available). */
  readonly raw: AxiosError | Error
  /** HTTP status code (only for HTTP errors). */
  readonly status?: number
  /** Business code from response body (only for business errors). */
  readonly businessCode?: number
  /** The request config that triggered this error. */
  readonly config?: AxiosRequestConfig

  constructor(
    type: ErrorType,
    raw: AxiosError | Error,
    extra?: { status?: number; businessCode?: number; config?: AxiosRequestConfig },
  ) {
    super(raw.message)
    this.name = 'ZhiAxiosError'
    this.type = type
    this.raw = raw
    this.status = extra?.status
    this.businessCode = extra?.businessCode
    this.config = extra?.config ?? (raw as AxiosError).config
  }
}

/**
 * Classify an error into a well-known ErrorType.
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof ZhiAxiosError) return error.type

  if (axios.isCancel(error)) return ErrorType.Cancel

  if (axios.isAxiosError(error)) {
    const err = error as AxiosError
    if (
      err.code === 'ECONNABORTED' ||
      err.code === 'ETIMEDOUT' ||
      err.message?.toLowerCase().includes('timeout')
    ) {
      return ErrorType.Timeout
    }
    if (!err.response) return ErrorType.Network
    return ErrorType.Http
  }

  return ErrorType.Unknown
}
