import { toast } from "sonner"

import { getSessionStored, setSessionStored } from "@/lib/safe-storage"

/**
 * Auto-refreshes a long-lived tab onto the current deploy.
 *
 * `chunk-reload.ts` only recovers a tab that *navigates* to a lazy route whose
 * chunk rotated (it listens for `vite:preloadError`). A tab parked on an
 * already-loaded page — the standings board left open on a second monitor
 * through a broadcast — never requests a new chunk, so it keeps running stale
 * code indefinitely. That code then breaks the moment the API changes shape
 * under it: the 2026-06-05 standings crash was hundreds of weeks-old tabs
 * throwing on `tournament_record.recent_results` after the API dropped the
 * field, none of which a preload-error handler would ever have caught.
 *
 * This polls a build-stamped `version.json` (emitted at the deploy root by the
 * `emit-version-json` Vite plugin, carrying the same SHA baked into the bundle
 * as `__APP_RELEASE__`). When the deployed build no longer matches the one this
 * tab is running, it refreshes:
 *   - a backgrounded tab reloads immediately — the viewer isn't looking, so the
 *     refresh is invisible and they return to the current build (this is the
 *     population that caused the incident);
 *   - a foreground tab is never yanked mid-read: it shows a dismissible toast
 *     with a "Refresh now" action and reloads on its own the next time the tab
 *     is hidden.
 *
 * A sessionStorage guard keyed on the *target* version prevents a reload loop
 * if an edge briefly serves a fresh `version.json` against a stale `index.html`.
 */

/** Path to the build-stamped version manifest, base-path aware. */
function versionUrl(): string {
  // `import.meta.env.BASE_URL` is "/kings-gauntlet/" on the prod deploy and "/"
  // elsewhere; netlify.toml maps the prefixed request back to the root file.
  return `${import.meta.env.BASE_URL}version.json`
}

/** The build identifier this tab is running (commit SHA on CI, "dev" locally). */
const CURRENT_VERSION = __APP_RELEASE__

/** How often to poll for a newer deploy. */
const POLL_INTERVAL_MS = 60_000

/**
 * sessionStorage key + window guarding against a reload loop. We record the
 * version we last reloaded *toward*; a repeat reload for that same target
 * within the window is skipped, so a momentarily-inconsistent edge (fresh
 * version.json, stale index.html) can't thrash. A genuinely newer deploy
 * carries a different SHA and is never blocked.
 */
const RELOAD_MARK_KEY = "versionReloadAt"
const RELOAD_GUARD_MS = 60_000

type CheckResult =
  | { status: "current" }
  /** version.json was unreachable or unparseable — treated as a no-op. */
  | { status: "unknown" }
  /** A newer build is live but a recent reload for it is still in the guard window. */
  | { status: "skipped"; deployed: string }
  /** A newer build is live and this (hidden) tab was reloaded. */
  | { status: "reloaded"; deployed: string }
  /** A newer build is live and this (foreground) tab should be prompted. */
  | { status: "update-available"; deployed: string }

interface CheckDeps {
  current: string
  fetchVersion: () => Promise<string | null>
  reload: () => void
  isHidden: () => boolean
  now: () => number
}

/**
 * One comparison of the running build against the deployed one. Pure except for
 * the injected effects, so the decision table is unit-testable without timers,
 * a real network, or a real navigation. A hidden tab is reloaded here directly;
 * a foreground tab is reported back as `update-available` for the caller to
 * surface (so the "notify once per version" state lives in one place).
 */
export async function checkForUpdate(
  deps: Partial<CheckDeps> = {}
): Promise<CheckResult> {
  const current = deps.current ?? CURRENT_VERSION
  const fetchVersion = deps.fetchVersion ?? fetchDeployedVersion
  const reload = deps.reload ?? defaultReload
  const isHidden = deps.isHidden ?? (() => document.hidden)
  const now = deps.now ?? Date.now

  const deployed = await fetchVersion()
  if (!deployed) return { status: "unknown" }
  if (deployed === current) return { status: "current" }

  if (reloadedRecentlyFor(deployed, now)) return { status: "skipped", deployed }

  if (isHidden()) {
    reloadFor(deployed, reload, now)
    return { status: "reloaded", deployed }
  }
  return { status: "update-available", deployed }
}

/** Fetches `{ version }` from the manifest; returns null on any failure. */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    // `no-store` bypasses the browser HTTP cache; the manifest's response
    // headers (netlify.toml) keep edges revalidating so polls see new builds.
    const res = await fetch(versionUrl(), { cache: "no-store" })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const version = (data as { version?: unknown }).version
    return typeof version === "string" && version.length > 0 ? version : null
  } catch {
    // Offline, blocked, or a misrouted request returning the SPA shell (which
    // fails JSON.parse). Either way the check is a silent no-op.
    return null
  }
}

function defaultReload(): void {
  window.location.reload()
}

/** Records the target version, then reloads. */
function reloadFor(
  version: string,
  reload: () => void,
  now: () => number
): void {
  rememberReload(version, now)
  reload()
}

function reloadedRecentlyFor(version: string, now: () => number): boolean {
  const raw = getSessionStored(RELOAD_MARK_KEY)
  if (!raw) return false
  try {
    const { v, t } = JSON.parse(raw) as { v?: string; t?: number }
    return v === version && typeof t === "number" && now() - t < RELOAD_GUARD_MS
  } catch {
    // Malformed payload — treat as no prior reload (the per-target SHA still
    // changes between genuine deploys, so we won't wrongly block one).
    return false
  }
}

function rememberReload(version: string, now: () => number): void {
  setSessionStored(RELOAD_MARK_KEY, JSON.stringify({ v: version, t: now() }))
}

/**
 * Starts polling for new deploys. `reload`/`fetchVersion`/`intervalMs` are
 * injectable for tests; production uses a real reload, a real fetch, and a
 * 60s interval. Returns a disposer that stops polling and removes listeners.
 *
 * No-op in dev/local: with no real deploy SHA (`__APP_RELEASE__ === "dev"`)
 * there's nothing meaningful to compare against.
 */
export function installVersionCheck(
  opts: {
    reload?: () => void
    fetchVersion?: () => Promise<string | null>
    intervalMs?: number
  } = {}
): () => void {
  const reload = opts.reload ?? defaultReload
  const fetchVersion = opts.fetchVersion ?? fetchDeployedVersion
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS

  if (CURRENT_VERSION === "dev") return () => {}

  // The newer version we've surfaced to a foreground tab but not yet reloaded
  // for; armed so the tab refreshes the next time it's hidden.
  let pending: string | null = null
  let disposed = false

  const tick = async (): Promise<void> => {
    if (disposed) return
    const result = await checkForUpdate({ reload, fetchVersion })
    if (result.status === "update-available") {
      const { deployed } = result
      if (pending !== deployed) {
        pending = deployed
        toast("A new version is available", {
          description: "This page will refresh to update.",
          action: {
            label: "Refresh now",
            onClick: () => reloadFor(deployed, reload, Date.now),
          },
          duration: Infinity,
        })
      }
    } else if (result.status === "current") {
      pending = null
    }
  }

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      // Foreground prompt outstanding → refresh now that the viewer looked away.
      if (pending) reloadFor(pending, reload, Date.now)
    } else {
      // Returned to the tab — check promptly rather than waiting for the timer.
      void tick()
    }
  }
  const onFocus = (): void => void tick()

  document.addEventListener("visibilitychange", onVisibilityChange)
  window.addEventListener("focus", onFocus)
  const timer = window.setInterval(() => void tick(), intervalMs)
  void tick()

  return () => {
    disposed = true
    document.removeEventListener("visibilitychange", onVisibilityChange)
    window.removeEventListener("focus", onFocus)
    window.clearInterval(timer)
  }
}
