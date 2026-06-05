/**
 * Recovers from stale code-split chunks after a redeploy.
 *
 * Every deploy rebuilds route chunks with new content-hash filenames. A tab
 * still running the previous build holds route imports pointing at the old
 * chunk names; navigating to a lazy route (e.g. `/stats`, whose component is
 * split into `stats.lazy-<hash>.js`) then fails to fetch the now-removed file
 * and the dynamic import rejects — surfacing as an unhandled rejection
 * ("Failed to fetch dynamically imported module" in Chrome, "error loading
 * dynamically imported module" in Firefox). Vite raises a `vite:preloadError`
 * event for exactly this case.
 *
 * On the first such error we reload once: a fresh document pulls the current
 * build's HTML and chunk names, after which the lazy import succeeds. The
 * reload is recorded (sessionStorage) so a deploy that is *genuinely* broken —
 * assets missing for everyone, not just stale tabs — doesn't reload-loop: a
 * second failure within the guard window is left to propagate (Vite re-throws
 * it, so it still reaches Sentry) instead of being suppressed.
 */
import { getSessionStored, setSessionStored } from "@/lib/safe-storage"

declare global {
  interface Window {
    /**
     * Set for the brief window between detecting a stale-chunk error and the
     * recovery reload navigating away. Read by Sentry's `beforeSend` to drop
     * errors thrown during that teardown — chiefly the router dereferencing the
     * `undefined` the failed import resolves to under `preventDefault()`.
     */
    __chunkReloadInFlight?: boolean
  }
}

const RELOAD_MARK_KEY = "chunkReloadAt"
const RELOAD_GUARD_MS = 10_000

/**
 * Registers the `vite:preloadError` handler. `reload` is injectable so tests
 * can observe it without a real navigation; production uses a full reload.
 * Returns a disposer that removes the listener.
 */
export function installChunkReloadHandler(
  reload: () => void = () => window.location.reload()
): () => void {
  // Per-load guard: if several lazy routes fail in one document we still reload
  // only once. The cross-reload guard lives in sessionStorage (below).
  let reloadedThisLoad = false

  const handler = (event: Event) => {
    if (reloadedThisLoad || reloadedRecently()) return
    reloadedThisLoad = true
    // We're recovering via reload — stop Vite re-throwing this as an error so
    // expected deploy churn stays out of Sentry.
    event.preventDefault()
    rememberReload()
    // Under preventDefault the failed import resolves `undefined`, so the
    // router can throw on it in the microtask before the reload navigates away.
    // Flag the teardown so Sentry drops that moot error (see sentry.ts).
    window.__chunkReloadInFlight = true
    reload()
  }

  window.addEventListener("vite:preloadError", handler)
  return () => window.removeEventListener("vite:preloadError", handler)
}

function reloadedRecently(): boolean {
  // Storage blocked (private mode / WebView) makes this read `null` →
  // `Number(null)` is 0 → treated as "not reloaded recently". The per-load
  // `reloadedThisLoad` guard still prevents an immediate reload loop.
  const last = Number(getSessionStored(RELOAD_MARK_KEY))
  return last > 0 && Date.now() - last < RELOAD_GUARD_MS
}

function rememberReload(): void {
  setSessionStored(RELOAD_MARK_KEY, String(Date.now()))
}
