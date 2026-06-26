import { fetchArchiveData } from "./archive-data"
import { api } from "./api"
import { ARCHIVE_MODE } from "@/lib/archive-mode"

/**
 * Custom client adapter for orval that uses our configured Ky instance.
 * This ensures all generated API calls use our centralized configuration
 * (base URL, auth, error handling, etc.)
 *
 * Orval calls this as: orvalClient(url, requestInit)
 */
export const orvalClient = async <T>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  // Archive mode (#375): the live API is gone, so every read resolves from a
  // bundled static snapshot instead. Reads are GETs (an absent method is a GET
  // in orval's generated calls); the archive deploy has no write surface (admin
  // is disabled), so a non-GET reaching here is unexpected and falls through to
  // throw rather than silently hitting a dead backend.
  if (ARCHIVE_MODE) {
    const method = (options?.method ?? "GET").toUpperCase()
    if (method === "GET") {
      return fetchArchiveData<T>(url)
    }
    throw new Error(`${method} ${url} is unavailable in archive mode.`)
  }

  // Remove leading slash if present since Ky prefixUrl handles it
  const normalizedUrl = url.startsWith("/") ? url.slice(1) : url

  // Normalize body for Ky: JSON stringify plain objects, pass through supported types
  let kyBody = options?.body
  if (kyBody && typeof kyBody === "object") {
    const isFormData =
      typeof FormData !== "undefined" && kyBody instanceof FormData
    const isUrlSearchParams =
      typeof URLSearchParams !== "undefined" &&
      kyBody instanceof URLSearchParams
    const isBlob = typeof Blob !== "undefined" && kyBody instanceof Blob
    const isArrayBuffer = kyBody instanceof ArrayBuffer
    const isArrayBufferView = ArrayBuffer.isView(kyBody)
    const isReadableStream =
      typeof ReadableStream !== "undefined" && kyBody instanceof ReadableStream

    if (
      !isFormData &&
      !isUrlSearchParams &&
      !isBlob &&
      !isArrayBuffer &&
      !isArrayBufferView &&
      !isReadableStream
    ) {
      kyBody = JSON.stringify(kyBody)
    }
  }

  // Errors (network failures, 4xx/5xx) propagate to React Query's error handling
  const response = await api(normalizedUrl, {
    method: options?.method,
    headers: options?.headers,
    body: kyBody,
    signal: options?.signal,
  })

  // orval v8 with `httpClient: "fetch"` expects the mutator to return the
  // full `{ data, status, headers }` shape — the generated response types
  // are declared that way and the hooks read `.data` off it. Returning the
  // bare parsed body (the older orval convention) leaves every `.data`
  // access undefined.
  if (response.status === 204) {
    // 204 No Content — no body to parse.
    return {
      data: undefined,
      status: response.status,
      headers: response.headers,
    } as T
  }

  // Ensure we have JSON content
  const contentType = response.headers.get("content-type")
  if (!contentType?.includes("application/json")) {
    throw new Error(
      `Unexpected non-JSON response: ${response.status} ${contentType}`
    )
  }

  const data = await response.json()
  return { data, status: response.status, headers: response.headers } as T
}

export default orvalClient
