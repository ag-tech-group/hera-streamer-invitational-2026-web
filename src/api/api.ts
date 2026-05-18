import ky, { type Options } from "ky"

export const baseUrl = import.meta.env.VITE_API_URL || "/api"

export const api = ky.create({
  prefixUrl: baseUrl,
  timeout: 30000,
  // Retries are handled by TanStack React Query
  retry: 0,
})

export type { Options as ApiOptions }
