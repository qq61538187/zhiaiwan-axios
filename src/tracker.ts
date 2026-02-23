import type { AxiosError, AxiosInstance } from 'axios'
import type {
  ExtendedRequestConfig,
  InternalRequestConfig,
  RequestEntry,
  TrackerHooks,
} from './types'

let uid = 0
function nextId(): string {
  return `req_${++uid}_${Date.now()}`
}

/**
 * Tracks every in-flight request with ID, group, AbortController.
 * Fires lifecycle hooks so consumers can react to queue changes.
 */
export class RequestTracker {
  private entries = new Map<
    string,
    { entry: RequestEntry; controller: AbortController; slowTimer?: ReturnType<typeof setTimeout> }
  >()
  private hooks: TrackerHooks
  private _loading = false

  constructor(hooks: TrackerHooks = {}) {
    this.hooks = hooks
  }

  get loading(): boolean {
    return this._loading
  }

  get queue(): ReadonlyArray<RequestEntry> {
    return Array.from(this.entries.values()).map((v) => ({ ...v.entry }))
  }

  /** Register a request: assign ID, attach AbortController, fire hooks. */
  add(config: ExtendedRequestConfig): void {
    const cfg = config as InternalRequestConfig
    const existingId = cfg._trackerId

    // Retry re-request: entry still alive — update controller only, skip hooks
    if (existingId && this.entries.has(existingId)) {
      const record = this.entries.get(existingId)!
      const controller = new AbortController()
      if (cfg.signal && 'addEventListener' in cfg.signal) {
        ;(cfg.signal as AbortSignal).addEventListener('abort', () => controller.abort(), {
          once: true,
        })
      }
      cfg.signal = controller.signal
      record.controller = controller
      return
    }

    const id = cfg.requestId || existingId || nextId()
    cfg._trackerId = id

    const controller = new AbortController()
    if (cfg.signal && 'addEventListener' in cfg.signal) {
      ;(cfg.signal as AbortSignal).addEventListener('abort', () => controller.abort(), {
        once: true,
      })
    }
    cfg.signal = controller.signal

    const entry: RequestEntry = {
      id,
      group: cfg.requestGroup,
      method: (cfg.method ?? 'GET').toUpperCase(),
      url: cfg.url ?? '',
      startedAt: Date.now(),
    }

    let slowTimer: ReturnType<typeof setTimeout> | undefined
    if (this.hooks.slowThreshold && this.hooks.slowThreshold > 0 && this.hooks.onSlowRequest) {
      const cb = this.hooks.onSlowRequest
      slowTimer = setTimeout(() => {
        if (this.entries.has(id)) {
          cb({ ...entry, duration: Date.now() - entry.startedAt })
        }
      }, this.hooks.slowThreshold)
    }

    this.entries.set(id, { entry, controller, slowTimer })
    this.hooks.onRequestStart?.(entry)
    this.updateLoading()
    this.hooks.onQueueChange?.(this.queue)
  }

  /** Remove a completed request and fire hooks. */
  remove(config: ExtendedRequestConfig): void {
    const id = (config as InternalRequestConfig)._trackerId
    if (!id) return

    const record = this.entries.get(id)
    if (!record) return

    if (record.slowTimer) clearTimeout(record.slowTimer)

    const completedEntry: RequestEntry = {
      ...record.entry,
      duration: Date.now() - record.entry.startedAt,
    }

    this.entries.delete(id)
    this.hooks.onRequestEnd?.(completedEntry)
    this.updateLoading()
    this.hooks.onQueueChange?.(this.queue)
  }

  /** Abort all requests in a specific group. */
  cancelGroup(group: string): void {
    for (const [id, record] of this.entries) {
      if (record.entry.group === group) {
        if (record.slowTimer) clearTimeout(record.slowTimer)
        record.controller.abort()
        this.entries.delete(id)
        this.hooks.onRequestEnd?.({
          ...record.entry,
          duration: Date.now() - record.entry.startedAt,
        })
      }
    }
    this.updateLoading()
    this.hooks.onQueueChange?.(this.queue)
  }

  /** Abort a single request by its ID. */
  cancelById(id: string): void {
    const record = this.entries.get(id)
    if (!record) return

    if (record.slowTimer) clearTimeout(record.slowTimer)
    record.controller.abort()
    this.entries.delete(id)
    this.hooks.onRequestEnd?.({
      ...record.entry,
      duration: Date.now() - record.entry.startedAt,
    })
    this.updateLoading()
    this.hooks.onQueueChange?.(this.queue)
  }

  /** Abort every in-flight request. */
  cancelAll(): void {
    for (const record of this.entries.values()) {
      if (record.slowTimer) clearTimeout(record.slowTimer)
      record.controller.abort()
      this.hooks.onRequestEnd?.({
        ...record.entry,
        duration: Date.now() - record.entry.startedAt,
      })
    }
    this.entries.clear()
    this.updateLoading()
    this.hooks.onQueueChange?.(this.queue)
  }

  private updateLoading(): void {
    const next = this.entries.size > 0
    if (next !== this._loading) {
      this._loading = next
      this.hooks.onLoadingChange?.(next)
    }
  }
}

/**
 * Install tracker request interceptor + response SUCCESS handler.
 * The error handler is installed separately (after retry) via installTrackerCleanup.
 */
export function installTracker(instance: AxiosInstance, tracker: RequestTracker): void {
  instance.interceptors.request.use((config) => {
    tracker.add(config as InternalRequestConfig)
    return config
  })

  instance.interceptors.response.use((response) => {
    tracker.remove(response.config as InternalRequestConfig)
    return response
  })
}

/**
 * Install tracker response ERROR handler.
 * Must be installed AFTER the retry interceptor so that entries stay alive
 * during the retry cycle and remain reachable by cancel methods.
 */
export function installTrackerCleanup(instance: AxiosInstance, tracker: RequestTracker): void {
  instance.interceptors.response.use(undefined, (error: AxiosError) => {
    if (error.config) {
      tracker.remove(error.config as InternalRequestConfig)
    }
    return Promise.reject(error)
  })
}
