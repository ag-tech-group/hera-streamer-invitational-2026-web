import { useCallback, useState } from "react"

import { parseApiError } from "@/lib/api-errors"

/**
 * A stable UUIDv4 that survives renders and React Query's built-in retries,
 * with an explicit `reset()` to advance the value once the current logical
 * operation has finished. Pair with a mutation that sends the value via the
 * `Idempotency-Key` header (see #71): retries of the *same* user action
 * keep the same key (so the backend can replay its cached response),
 * while a fresh user action gets a fresh key.
 *
 * State-based (not ref-based) so that calling `reset()` after a successful
 * submit triggers a render, which feeds the new value back through the
 * mutation hook's `request.headers` on the next render. A ref would
 * update silently without informing the mutation hook.
 *
 * Lifecycle convention:
 *   - First render: a UUID is generated lazily, once per hook instance.
 *   - User submits → mutation sends with `current`.
 *   - Mutation auto-retries (network drop, 5xx) → same `current` is reused.
 *   - On `onSuccess`, the consumer calls `reset()` → fresh UUID, ready
 *     for the next submit.
 *   - On `onError`, the consumer passes the error through
 *     `resetOnReusedKey` — if the backend responded
 *     `idempotency_key_reused` (same key, *different* body), the key
 *     advances so the next submit isn't dead-on-arrival.
 */
export function useIdempotencyKey(): {
  current: string
  reset: () => void
  resetOnReusedKey: (err: unknown) => Promise<void>
} {
  const [key, setKey] = useState<string>(() => crypto.randomUUID())
  const reset = useCallback(() => setKey(crypto.randomUUID()), [])
  const resetOnReusedKey = useCallback(async (err: unknown) => {
    const parsed = await parseApiError(err)
    if (parsed.errorCode === "idempotency_key_reused") {
      setKey(crypto.randomUUID())
    }
  }, [])
  return { current: key, reset, resetOnReusedKey }
}
