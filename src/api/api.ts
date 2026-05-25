import ky, { type Options } from "ky"

export const baseUrl = import.meta.env.VITE_API_URL || "/api"

export const api = ky.create({
  prefixUrl: baseUrl,
  timeout: 30000,
  // Send the `criticalbit_access` cookie (scoped to `.criticalbit.gg`)
  // on every request so the standings API can identify the current
  // user via `/v1/me` and gate write endpoints by tournament ownership.
  // The API must respond with `Access-Control-Allow-Credentials: true`
  // and a specific origin (not `*`) for these to be accepted.
  credentials: "include",
  // Retries are handled by TanStack React Query
  retry: 0,
})

export type { Options as ApiOptions }
