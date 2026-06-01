import { lazy, Suspense, useEffect } from "react"
import { Outlet, useRouter } from "@tanstack/react-router"
import { Toaster } from "sonner"

import { Navbar } from "@/components/navbar"
import { SiteAtmosphere } from "@/components/site-atmosphere"
import { SiteFooter } from "@/components/site-footer"
import { SiteParticles } from "@/components/site-particles"
import { useTheme } from "@/components/theme-provider"
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
  // Match the toasts to the active theme (#228). Sonner defaults to light, so
  // without this its surfaces stay light even in dark mode. `theme` may be
  // "system", which sonner resolves against `prefers-color-scheme` natively —
  // the same resolution `ThemeProvider` applies to the `<html>` class — so the
  // two never disagree.
  const { theme } = useTheme()
  return (
    <>
      <RouteTracker />
      {/*
       * Site-wide team-colour atmosphere wash (#114). Mounted here at the
       * router root so it covers every route — Home (Players + Teams),
       * Admin, and the not-found / error boundaries — rather than being
       * scoped to a specific tab. Fixed-positioned, so its location in
       * the JSX tree just decides lifecycle; viewport coverage is the
       * same regardless.
       */}
      <SiteAtmosphere />
      <SiteParticles />
      <Navbar />
      {/*
       * Sticky-footer layout: `min-h-svh` on the wrapper plus `flex-1`
       * on `<main>` keeps the footer pinned to the bottom even when the
       * routed page is shorter than the viewport. `pt-14` clears the
       * fixed `<Navbar>` (h-14). Pages render into `<main>` and no
       * longer need their own `min-h-svh`.
       */}
      <div className="flex min-h-svh flex-col pt-14">
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
      <Suspense fallback={null}>
        <TanStackRouterDevtools />
        <ReactQueryDevtools />
      </Suspense>
    </>
  )
}
