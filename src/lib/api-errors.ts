import { useEffect, useState } from "react"

import i18n from "@/lib/i18n"

/**
 * UI-facing error shape, decoupled from which response envelope the backend
 * happened to use. See issue #70 and the backend rollout in
 * `aoe2-live-standings-api#71`: the API is migrating to a structured envelope
 * (`{ error_code, message, request_id, ... }`) but the legacy FastAPI
 * `{ detail }` shapes still ship alongside it during the rollout, so the UI
 * has to handle both transparently.
 */
export interface NormalizedError {
  /**
   * Stable machine identifier. From the new envelope when present;
   * `_legacy_http_<status>` for string-detail HTTPException responses;
   * `"validation_error"` for pydantic detail arrays; `"unknown_error"` for
   * everything else (including no-response failures like network drops).
   */
  errorCode: string
  /** Human-readable English description, suitable as a default toast/alert body. */
  message: string
  /**
   * The X-Request-ID / envelope `request_id` for this response. Surface it
   * in error UI ("Reference: <id>") so users can quote it to support.
   */
  requestId?: string
  /** Raw payload for validation errors (per-field messages, etc.). */
  details?: unknown
}

/** Envelope body shape (the new shape from aoe2-live-standings-api#71). */
interface EnvelopeErrorBody {
  error_code: string
  message: string
  request_id?: string
  timestamp?: string
  details?: unknown
}

/** Legacy `HTTPException` body (FastAPI default). */
interface LegacyHttpExceptionBody {
  detail: string
}

/** Legacy pydantic validation body. */
interface LegacyValidationBody {
  detail: Array<{ loc?: unknown; msg: string; type?: string }>
}

/**
 * Translation keys for the per-HTTP-status fallback copy. Used when no body
 * can be parsed (network failure, non-JSON response) or as the message for
 * the fallback `unknown_error` branch. Each key resolves through `i18n.t`
 * at call time, so a language change is picked up by the next toast or
 * `useNormalizedError` consumer without any cache to invalidate.
 */
const STATUS_MESSAGE_KEYS: Record<number, string> = {
  400: "errors.400",
  401: "errors.401",
  403: "errors.403",
  404: "errors.404",
  409: "errors.409",
  422: "errors.422",
  429: "errors.429",
  500: "errors.500",
}

/**
 * Translation keys keyed on the new envelope's `error_code`. Codes not
 * listed here fall back to the envelope's own `message`. Add an entry
 * when a code deserves a friendlier or more actionable message than the
 * backend default.
 */
const ERROR_CODE_MESSAGE_KEYS: Record<string, string> = {
  // The form changed mid-flight relative to a previous submit that reused
  // the same key. `useIdempotencyKey().resetOnReusedKey` advances the key
  // for us — the user just needs to submit again.
  idempotency_key_reused: "errors.idempotencyKeyReused",
  tournament_not_found: "errors.tournamentNotFound",
}

const DEFAULT_MESSAGE_KEY = "errors.default"

/**
 * Parse an error thrown by ky / fetch into a `NormalizedError`. Recognises
 * three response shapes during the API's envelope rollout:
 *
 *   1. New envelope: `{ error_code, message, request_id, ... }`.
 *   2. Legacy `HTTPException`: `{ detail: "<string>" }`.
 *   3. Legacy pydantic validation: `{ detail: [{ msg, ... }, ...] }`.
 *
 * Errors without a `response` (network drops, etc.) and bodies that match
 * none of the above fall back to `errorCode: "unknown_error"` with a status
 * code message when available.
 */
export async function parseApiError(error: unknown): Promise<NormalizedError> {
  const response = (error as { response?: Response })?.response
  if (!response) {
    return { errorCode: "unknown_error", message: i18n.t(DEFAULT_MESSAGE_KEY) }
  }

  // X-Request-ID is the response-header counterpart of the envelope's
  // `request_id`. Grab it before parsing so legacy bodies (which don't carry
  // it in the body) can still surface a reference.
  const headerRequestId = response.headers.get("x-request-id") ?? undefined

  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    return {
      errorCode: "unknown_error",
      message: statusFallbackMessage(response.status),
      requestId: headerRequestId,
    }
  }

  if (isEnvelope(body)) {
    return {
      errorCode: body.error_code,
      message: body.message,
      requestId: body.request_id ?? headerRequestId,
      details: body.details,
    }
  }

  if (isLegacyHttpException(body)) {
    return {
      errorCode: `_legacy_http_${response.status}`,
      message: body.detail,
      requestId: headerRequestId,
    }
  }

  if (isLegacyValidation(body)) {
    return {
      errorCode: "validation_error",
      message: body.detail.map((e) => e.msg).join(". "),
      requestId: headerRequestId,
      details: body.detail,
    }
  }

  return {
    errorCode: "unknown_error",
    message: statusFallbackMessage(response.status),
    requestId: headerRequestId,
  }
}

function statusFallbackMessage(status: number): string {
  const key = STATUS_MESSAGE_KEYS[status]
  return key ? i18n.t(key) : i18n.t(DEFAULT_MESSAGE_KEY)
}

/**
 * Pick the most useful user-facing message: a curated per-code override
 * (`ERROR_CODE_MESSAGES`) when present, then the envelope's own message,
 * then a caller-provided fallback, then a generic default.
 *
 * `error_code` itself is a stable machine identifier and should never be
 * shown to users.
 */
export function getUserMessage(
  error: NormalizedError,
  fallback?: string
): string {
  const curatedKey = ERROR_CODE_MESSAGE_KEYS[error.errorCode]
  // `||` (not `??`) so an empty `message` falls through to the fallback
  // instead of being treated as a valid display string.
  return (
    (curatedKey ? i18n.t(curatedKey) : undefined) ||
    error.message ||
    fallback ||
    i18n.t(DEFAULT_MESSAGE_KEY)
  )
}

/**
 * React hook that surfaces `parseApiError`'s async result synchronously to a
 * render. Returns `null` until parsing completes (or when `error` is falsy
 * or differs from the one the last completed parse resolved for).
 *
 * The state keeps a `source` reference alongside the parsed `normalized`
 * value: this lets the render derive "is the stored result still valid?"
 * without an imperative reset, which avoids a synchronous setState inside
 * the effect (React 19's `set-state-in-effect` rule).
 */
export function useNormalizedError(error: unknown): NormalizedError | null {
  const [state, setState] = useState<{
    source: unknown
    normalized: NormalizedError | null
  }>({ source: null, normalized: null })

  useEffect(() => {
    if (!error) return
    let cancelled = false
    parseApiError(error).then((result) => {
      if (!cancelled) setState({ source: error, normalized: result })
    })
    return () => {
      cancelled = true
    }
  }, [error])

  // The stored result is only valid while the current `error` matches the
  // one it was parsed from — covers both the "parse in flight" case and the
  // "error cleared" case in a single render-time check.
  return state.source === error ? state.normalized : null
}

function isEnvelope(body: unknown): body is EnvelopeErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "error_code" in body &&
    typeof (body as { error_code: unknown }).error_code === "string"
  )
}

function isLegacyHttpException(body: unknown): body is LegacyHttpExceptionBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof (body as { detail: unknown }).detail === "string"
  )
}

function isLegacyValidation(body: unknown): body is LegacyValidationBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    Array.isArray((body as { detail: unknown }).detail)
  )
}
