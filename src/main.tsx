import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { toast } from "sonner"
import { ErrorBoundary } from "./components/error-boundary"
import { NotFound } from "./components/not-found"
import { ThemeProvider } from "./components/theme-provider"
import "./index.css"
import "flag-icons/css/flag-icons.min.css"
import { AnalyticsProvider } from "./lib/analytics"
import { getUserMessage, parseApiError } from "./lib/api-errors"
import { FeatureFlagProvider } from "./lib/feature-flags"
import { initPostHog, posthogBackend } from "./lib/posthog"
import { initSentry } from "./lib/sentry"
import { routeTree } from "./routeTree.gen"

// Initialize Sentry as early as possible so init-time errors flow through.
// No-op when VITE_SENTRY_DSN is unset.
initSentry()

// Defer PostHog init until the browser is idle (#65 perf) so its ~60 KB gzip
// SDK doesn't compete with first paint. Events captured before the SDK
// finishes loading are queued by posthogBackend and flushed on init.
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => void initPostHog())
} else {
  setTimeout(() => void initPostHog(), 0)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: async (error, _variables, _context, mutation) => {
      if (mutation.meta?.skipGlobalError) return
      const normalized = await parseApiError(error)
      toast.error(getUserMessage(normalized), {
        description: normalized.requestId
          ? `Reference: ${normalized.requestId}`
          : undefined,
      })
    },
  }),
})

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: ErrorBoundary,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      skipGlobalError?: boolean
    }
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="app_theme">
        <AnalyticsProvider backend={posthogBackend}>
          <FeatureFlagProvider>
            <RouterProvider router={router} />
          </FeatureFlagProvider>
        </AnalyticsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
