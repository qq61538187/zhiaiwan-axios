import type { AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestTracker } from '../src/tracker'
import type { ExtendedRequestConfig } from '../src/types'

function createConfig(
  method: string,
  url: string,
  extra: Partial<ExtendedRequestConfig> = {},
): ExtendedRequestConfig {
  return {
    method,
    url,
    headers: {} as AxiosHeaders,
    ...extra,
  } as ExtendedRequestConfig
}

describe('RequestTracker', () => {
  let tracker: RequestTracker

  beforeEach(() => {
    tracker = new RequestTracker()
  })

  // ---- Basic queue management -------------------------------------------

  it('should start with empty queue and loading=false', () => {
    expect(tracker.queue).toEqual([])
    expect(tracker.loading).toBe(false)
  })

  it('should add requests to queue', () => {
    const config = createConfig('GET', '/users')
    tracker.add(config)

    expect(tracker.queue).toHaveLength(1)
    expect(tracker.queue[0].method).toBe('GET')
    expect(tracker.queue[0].url).toBe('/users')
  })

  it('should set loading=true when queue is non-empty', () => {
    const config = createConfig('GET', '/users')
    tracker.add(config)
    expect(tracker.loading).toBe(true)
  })

  it('should set loading=false after all requests removed', () => {
    const config = createConfig('GET', '/users')
    tracker.add(config)
    tracker.remove(config)
    expect(tracker.loading).toBe(false)
    expect(tracker.queue).toHaveLength(0)
  })

  // ---- Request ID -------------------------------------------------------

  it('should auto-generate ID when not specified', () => {
    const config = createConfig('GET', '/users')
    tracker.add(config)

    expect(config._trackerId).toBeDefined()
    expect(config._trackerId).toMatch(/^req_/)
    expect(tracker.queue[0].id).toBe(config._trackerId)
  })

  it('should use user-specified requestId', () => {
    const config = createConfig('GET', '/users', { requestId: 'my-request' })
    tracker.add(config)

    expect(config._trackerId).toBe('my-request')
    expect(tracker.queue[0].id).toBe('my-request')
  })

  // ---- Request Group ----------------------------------------------------

  it('should track request group', () => {
    const config = createConfig('GET', '/users', { requestGroup: 'user-module' })
    tracker.add(config)

    expect(tracker.queue[0].group).toBe('user-module')
  })

  // ---- Cancel by ID -----------------------------------------------------

  it('should cancel a specific request by ID', () => {
    const a = createConfig('GET', '/a', { requestId: 'req-a' })
    const b = createConfig('GET', '/b', { requestId: 'req-b' })
    tracker.add(a)
    tracker.add(b)

    tracker.cancelById('req-a')

    expect(a.signal!.aborted).toBe(true)
    expect(b.signal!.aborted).toBe(false)
    expect(tracker.queue).toHaveLength(1)
    expect(tracker.queue[0].id).toBe('req-b')
  })

  it('cancelById should be a no-op for unknown ID', () => {
    const a = createConfig('GET', '/a', { requestId: 'req-a' })
    tracker.add(a)
    tracker.cancelById('unknown')

    expect(tracker.queue).toHaveLength(1)
  })

  // ---- Cancel by Group --------------------------------------------------

  it('should cancel all requests in a group', () => {
    const a = createConfig('GET', '/a', { requestGroup: 'admin' })
    const b = createConfig('POST', '/b', { requestGroup: 'admin' })
    const c = createConfig('GET', '/c', { requestGroup: 'user' })
    tracker.add(a)
    tracker.add(b)
    tracker.add(c)

    tracker.cancelGroup('admin')

    expect(a.signal!.aborted).toBe(true)
    expect(b.signal!.aborted).toBe(true)
    expect(c.signal!.aborted).toBe(false)
    expect(tracker.queue).toHaveLength(1)
    expect(tracker.queue[0].group).toBe('user')
  })

  // ---- Cancel all -------------------------------------------------------

  it('should cancel all requests', () => {
    const a = createConfig('GET', '/a')
    const b = createConfig('POST', '/b')
    tracker.add(a)
    tracker.add(b)

    tracker.cancelAll()

    expect(a.signal!.aborted).toBe(true)
    expect(b.signal!.aborted).toBe(true)
    expect(tracker.queue).toHaveLength(0)
    expect(tracker.loading).toBe(false)
  })

  // ---- Hooks ------------------------------------------------------------

  it('should fire onQueueChange on add and remove', () => {
    const fn = vi.fn()
    tracker = new RequestTracker({ onQueueChange: fn })

    const config = createConfig('GET', '/users')
    tracker.add(config)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ url: '/users' })]),
    )

    tracker.remove(config)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith([])
  })

  it('should fire onLoadingChange only on transitions', () => {
    const fn = vi.fn()
    tracker = new RequestTracker({ onLoadingChange: fn })

    const a = createConfig('GET', '/a')
    const b = createConfig('GET', '/b')

    tracker.add(a)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(true)

    tracker.add(b)
    expect(fn).toHaveBeenCalledTimes(1) // no transition

    tracker.remove(a)
    expect(fn).toHaveBeenCalledTimes(1) // still has b

    tracker.remove(b)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(false)
  })

  it('should fire onRequestStart and onRequestEnd', () => {
    const onStart = vi.fn()
    const onEnd = vi.fn()
    tracker = new RequestTracker({ onRequestStart: onStart, onRequestEnd: onEnd })

    const config = createConfig('POST', '/submit', { requestId: 'submit-1' })
    tracker.add(config)
    expect(onStart).toHaveBeenCalledOnce()
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'submit-1',
        method: 'POST',
        url: '/submit',
      }),
    )

    tracker.remove(config)
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'submit-1',
      }),
    )
  })

  it('should fire onRequestEnd for each request when cancelGroup is called', () => {
    const onEnd = vi.fn()
    tracker = new RequestTracker({ onRequestEnd: onEnd })

    tracker.add(createConfig('GET', '/a', { requestGroup: 'g1' }))
    tracker.add(createConfig('GET', '/b', { requestGroup: 'g1' }))
    tracker.add(createConfig('GET', '/c', { requestGroup: 'g2' }))

    tracker.cancelGroup('g1')
    expect(onEnd).toHaveBeenCalledTimes(2)
  })

  it('should fire onRequestEnd for each request when cancelAll is called', () => {
    const onEnd = vi.fn()
    tracker = new RequestTracker({ onRequestEnd: onEnd })

    tracker.add(createConfig('GET', '/a'))
    tracker.add(createConfig('GET', '/b'))
    tracker.add(createConfig('GET', '/c'))

    tracker.cancelAll()
    expect(onEnd).toHaveBeenCalledTimes(3)
  })

  // ---- Duration -----------------------------------------------------------

  it('should include duration in onRequestEnd callback', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    tracker = new RequestTracker({ onRequestEnd: onEnd })

    const config = createConfig('GET', '/slow', { requestId: 'dur-test' })
    tracker.add(config)

    vi.advanceTimersByTime(150)
    tracker.remove(config)

    expect(onEnd).toHaveBeenCalledOnce()
    const entry = onEnd.mock.calls[0][0]
    expect(entry.duration).toBeGreaterThanOrEqual(150)
    vi.useRealTimers()
  })

  it('should include duration when cancelling by ID', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    tracker = new RequestTracker({ onRequestEnd: onEnd })

    tracker.add(createConfig('GET', '/x', { requestId: 'cancel-dur' }))
    vi.advanceTimersByTime(200)
    tracker.cancelById('cancel-dur')

    const entry = onEnd.mock.calls[0][0]
    expect(entry.duration).toBeGreaterThanOrEqual(200)
    vi.useRealTimers()
  })

  // ---- Slow Request Detection -------------------------------------------

  it('should fire onSlowRequest when threshold is exceeded', () => {
    vi.useFakeTimers()
    const onSlow = vi.fn()
    tracker = new RequestTracker({ slowThreshold: 3000, onSlowRequest: onSlow })

    tracker.add(createConfig('GET', '/slow-api', { requestId: 'slow-1' }))

    vi.advanceTimersByTime(2999)
    expect(onSlow).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2)
    expect(onSlow).toHaveBeenCalledOnce()
    expect(onSlow.mock.calls[0][0].id).toBe('slow-1')
    expect(onSlow.mock.calls[0][0].duration).toBeGreaterThanOrEqual(3000)
    vi.useRealTimers()
  })

  it('should not fire onSlowRequest if request completes in time', () => {
    vi.useFakeTimers()
    const onSlow = vi.fn()
    tracker = new RequestTracker({ slowThreshold: 5000, onSlowRequest: onSlow })

    const config = createConfig('GET', '/fast', { requestId: 'fast-1' })
    tracker.add(config)
    vi.advanceTimersByTime(1000)
    tracker.remove(config)

    vi.advanceTimersByTime(10000)
    expect(onSlow).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
