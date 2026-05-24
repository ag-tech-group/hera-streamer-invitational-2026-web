import { lazy, Suspense, useEffect } from "react"
import { Outlet, useRouter } from "@tanstack/react-router"
import { Toaster } from "sonner"

import { SiteFooter } from "@/components/site-footer"
import { useAnalytics } from "@/lib/analytics"

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/react-router-devtools").then((mod) => ({
        default: mod.TanStackRouterDevtools,
      }))
    )

const ReactQueryDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/react-query-devtools").then((mod) => ({
        default: mod.ReactQueryDevtools,
      }))
    )

/** Fires a page-view analytics event on every resolved route change. */
function RouteTracker() {
  const router = useRouter()
  const analytics = useAnalytics()
  useEffect(() => {
    return router.subscribe("onResolved", ({ toLocation }) => {
      analytics.page(toLocation.pathname)
    })
  }, [router, analytics])
  return null
}

/**
 * Root layout rendered by the root route — hosts the routed `<Outlet />`,
 * the global toaster, route-change analytics, and the dev-only devtools.
 *
 * Kept out of `routes/__root.tsx` so that file exports only its `Route`,
 * leaving both files clean Fast Refresh boundaries.
 */
export function RootComponent() {
  return (
    <>
      <RouteTracker />
      {/*
       * Sticky-footer layout: `min-h-svh` on the wrapper plus `flex-1`
       * on `<main>` keeps the footer pinned to the bottom even when the
       * routed page is shorter than the viewport. Pages render into
       * `<main>` and no longer need their own `min-h-svh`.
       */}
      <div className="flex min-h-svh flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster position="bottom-right" richColors closeButton />
      <Suspense fallback={null}>
        <TanStackRouterDevtools />
        <ReactQueryDevtools />
      </Suspense>
    </>
  )
}
