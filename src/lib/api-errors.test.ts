import { describe, expect, it } from "vitest"

import {
  getUserMessage,
  parseApiError,
  type NormalizedError,
} from "@/lib/api-errors"

/**
 * Build an error object that mirrors what ky throws for non-2xx responses:
 * a wrapper carrying a `response: Response`. Headers are optional and
 * default to none.
 */
function errorWithBody(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {}
) {
  const { status = 400, headers } = init
  return {
    response: new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    }),
  }
}

describe("parseApiError", () => {
  it("parses the new envelope shape", async () => {
    const result = await parseApiError(
      errorWithBody({
        error_code: "tournament_not_found",
        message: "Tournament not found",
        request_id: "abc-123",
        timestamp: "2026-05-24T10:00:00Z",
        details: null,
      })
    )
    expect(result).toEqual<NormalizedError>({
      errorCode: "tournament_not_found",
      message: "Tournament not found",
      requestId: "abc-123",
      details: null,
    })
  })

  it("prefers the envelope's request_id over the header", async () => {
    const result = await parseApiError(
      errorWithBody(
        {
          error_code: "tournament_not_found",
          message: "Tournament not found",
          request_id: "from-body",
        },
        { headers: { "x-request-id": "from-header" } }
      )
    )
    expect(result.requestId).toBe("from-body")
  })

  it("parses a legacy HTTPException with string detail", async () => {
    const result = await parseApiError(
      errorWithBody({ detail: "Not authenticated" }, { status: 401 })
    )
    expect(result).toMatchObject({
      errorCode: "_legacy_http_401",
      message: "Not authenticated",
    })
  })

  it("parses a legacy pydantic validation error with array detail", async () => {
    const result = await parseApiError(
      errorWithBody(
        {
          detail: [
            { loc: ["body", "name"], msg: "field required", type: "missing" },
            {
              loc: ["body", "email"],
              msg: "invalid email",
              type: "value_error.email",
            },
          ],
        },
        { status: 422 }
      )
    )
    expect(result.errorCode).toBe("validation_error")
    expect(result.message).toBe("field required. invalid email")
    expect(result.details).toHaveLength(2)
  })

  it("surfaces X-Request-ID for legacy errors via the response header", async () => {
    const result = await parseApiError(
      errorWithBody(
        { detail: "Not authenticated" },
        { status: 401, headers: { "x-request-id": "trace-id-xyz" } }
      )
    )
    expect(result.requestId).toBe("trace-id-xyz")
  })

  it("falls back to unknown_error when no body is parseable", async () => {
    const error = {
      response: new Response("not json at all", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    }
    const result = await parseApiError(error)
    expect(result.errorCode).toBe("unknown_error")
    // Status code drives the fallback message.
    expect(result.message).toMatch(/something went wrong/i)
  })

  it("falls back to unknown_error when the body shape matches nothing", async () => {
    const result = await parseApiError(
      errorWithBody({ unexpected: "shape" }, { status: 418 })
    )
    expect(result.errorCode).toBe("unknown_error")
  })

  it("returns unknown_error when there is no response (network failure)", async () => {
    const result = await parseApiError(new TypeError("Failed to fetch"))
    expect(result).toEqual<NormalizedError>({
      errorCode: "unknown_error",
      message: "An unexpected error occurred.",
    })
  })
})

describe("getUserMessage", () => {
  it("uses the curated copy for known error codes", () => {
    expect(
      getUserMessage({
        errorCode: "idempotency_key_reused",
        message: "raw backend message",
      })
    ).toMatch(/something changed/i)
  })

  it("falls back to the normalized message when the code is unknown", () => {
    expect(
      getUserMessage({
        errorCode: "_legacy_http_400",
        message: "Some legacy detail",
      })
    ).toBe("Some legacy detail")
  })

  it("uses the caller-provided fallback when no message is available", () => {
    expect(
      getUserMessage(
        { errorCode: "unknown_error", message: "" },
        "Custom fallback"
      )
    ).toBe("Custom fallback")
  })
})
