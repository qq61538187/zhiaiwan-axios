import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ThrottleOptions } from './types'

interface QueueItem {
  config: InternalAxiosRequestConfig
  resolve: (config: InternalAxiosRequestConfig) => void
}

/**
 * Limits the number of concurrent in-flight requests.
 * Excess requests are queued and dispatched in FIFO order as slots free up.
 */
export class RequestThrottle {
  private max: number
  private active = 0
  private queue: QueueItem[] = []

  constructor(options: ThrottleOptions) {
    this.max = options.maxConcurrent ?? Number.POSITIVE_INFINITY
  }

  acquire(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> | InternalAxiosRequestConfig {
    if (this.active < this.max) {
      this.active++
      return config
    }
    return new Promise<InternalAxiosRequestConfig>((resolve) => {
      this.queue.push({ config, resolve })
    })
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.queue.shift()
    if (next) {
      this.active++
      next.resolve(next.config)
    }
  }

  /** Number of requests currently waiting in the queue. */
  get pending(): number {
    return this.queue.length
  }
}

export function installThrottle(instance: AxiosInstance, throttle: RequestThrottle): void {
  instance.interceptors.request.use((config) => throttle.acquire(config))

  instance.interceptors.response.use(
    (response) => {
      throttle.release()
      return response
    },
    (error) => {
      throttle.release()
      return Promise.reject(error)
    },
  )
}
