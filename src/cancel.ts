import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import type { CancelOptions } from './types'

/**
 * Deduplication manager: tracks the latest request per `METHOD&url`.
 * When a duplicate arrives, the previous one's signal is aborted.
 */
export class CancelManager {
  private pending = new Map<string, AbortController>()
  private keyOption: NonNullable<CancelOptions['key']>

  constructor(options: CancelOptions = {}) {
    this.keyOption = options.key ?? 'method-url'
  }

  private static stableStringify(obj: unknown): string {
    if (obj === null || obj === undefined) return ''
    if (typeof obj !== 'object') return JSON.stringify(obj)
    if (Array.isArray(obj)) return `[${obj.map(CancelManager.stableStringify).join(',')}]`
    const sorted = Object.keys(obj as Record<string, unknown>).sort()
    const entries = sorted.map(
      (k) =>
        `${JSON.stringify(k)}:${CancelManager.stableStringify((obj as Record<string, unknown>)[k])}`,
    )
    return `{${entries.join(',')}}`
  }

  private getKey(config: InternalAxiosRequestConfig): string {
    const method = (config.method ?? 'GET').toUpperCase()
    const url = config.url ?? ''

    if (typeof this.keyOption === 'function') {
      const custom = this.keyOption(config as AxiosRequestConfig)
      return custom || `${method}&${url}`
    }

    if (this.keyOption === 'method-url-params-data') {
      const params = config.params ? CancelManager.stableStringify(config.params) : ''
      const data = config.data ? CancelManager.stableStringify(config.data) : ''
      return `${method}&${url}&${params}&${data}`
    }

    return `${method}&${url}`
  }

  /**
   * If a duplicate request (same method+url) is already in flight,
   * abort it. Then register this request's signal for future dedup.
   */
  setup(config: InternalAxiosRequestConfig): void {
    const key = this.getKey(config)

    const existing = this.pending.get(key)
    if (existing) {
      existing.abort()
    }

    const controller = new AbortController()
    const originalSignal = config.signal

    if (originalSignal && 'addEventListener' in originalSignal) {
      ;(originalSignal as AbortSignal).addEventListener('abort', () => controller.abort(), {
        once: true,
      })
      controller.signal.addEventListener('abort', () => this.pending.delete(key), { once: true })
    }

    config.signal = controller.signal
    this.pending.set(key, controller)
  }

  /** Remove the entry after the request completes. */
  remove(config: InternalAxiosRequestConfig): void {
    const key = this.getKey(config)
    this.pending.delete(key)
  }

  /** Abort all pending requests and clear the map. */
  cancelAll(): void {
    for (const controller of this.pending.values()) {
      controller.abort()
    }
    this.pending.clear()
  }
}
