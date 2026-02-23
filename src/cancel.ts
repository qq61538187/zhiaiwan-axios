import type { InternalAxiosRequestConfig } from 'axios'

/**
 * Deduplication manager: tracks the latest request per `METHOD&url`.
 * When a duplicate arrives, the previous one's signal is aborted.
 */
export class CancelManager {
  private pending = new Map<string, AbortController>()

  private static getKey(config: InternalAxiosRequestConfig): string {
    return `${(config.method ?? 'GET').toUpperCase()}&${config.url ?? ''}`
  }

  /**
   * If a duplicate request (same method+url) is already in flight,
   * abort it. Then register this request's signal for future dedup.
   */
  setup(config: InternalAxiosRequestConfig): void {
    const key = CancelManager.getKey(config)

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
    const key = CancelManager.getKey(config)
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
