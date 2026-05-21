import { vi } from "vitest"

type SseListener = (event: MessageEvent) => void

/**
 * Controllable `EventSource` stand-in for tests.
 *
 * jsdom ships no `EventSource`, and a real one would open a live network
 * connection — neither works for a deterministic suite. Instances register
 * themselves on a static list, so a test can grab the most recent one and
 * push events into it with `emit()`.
 *
 * Registered globally in `src/test/setup.ts`; `reset()` runs after each test.
 */
export class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  /** Every instance constructed since the last `reset()`, in order. */
  static instances: MockEventSource[] = []

  /** The most recently constructed instance; throws if there is none. */
  static last(): MockEventSource {
    const instance = MockEventSource.instances.at(-1)
    if (!instance) {
      throw new Error("No MockEventSource has been constructed")
    }
    return instance
  }

  static reset(): void {
    MockEventSource.instances = []
  }

  readonly url: string
  readyState: number = MockEventSource.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null

  readonly close = vi.fn((): void => {
    this.readyState = MockEventSource.CLOSED
  })

  private readonly listeners = new Map<string, Set<SseListener>>()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: SseListener): void {
    const set = this.listeners.get(type) ?? new Set<SseListener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: SseListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  /** Test helper: deliver an SSE event, mirroring the real `{ data }` shape. */
  emit(type: string, data: unknown = {}): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) })
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}
