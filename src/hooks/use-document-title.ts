import { useEffect } from "react"

import { activeTournament } from "@/config/tournaments"

/**
 * Sets `document.title` for the current page (#178, #179).
 *
 * The base title is `"<name> (<hostLabel>)"`, with the tournament's `game`
 * appended after an em-dash when set — e.g. `"The King's Gauntlet (Hosted
 * by Hera) — Age of Empires II"`. `hostLabel` and `game` are each optional
 * and dropped when unset. An optional `pageLabel` is appended after `" - "`
 * for sub-routes, so `/admin` resolves to `"… — Age of Empires II - Admin"`;
 * `/` stays at the bare base title.
 *
 * The base mirrors the static `<title>` / `og:title` in `index.html` — keep
 * them in sync, since non-JS scrapers read those instead of this runtime
 * write.
 *
 * Pages call this once at top level; the underlying `useEffect` re-runs
 * only when `pageLabel` changes, so the typical "stay on one route"
 * case is a one-shot DOM write.
 */
export function useDocumentTitle(pageLabel?: string): void {
  useEffect(() => {
    const brandHost = activeTournament.hostLabel
      ? `${activeTournament.name} (${activeTournament.hostLabel})`
      : activeTournament.name
    const base = activeTournament.game
      ? `${brandHost} — ${activeTournament.game}`
      : brandHost
    document.title = pageLabel ? `${base} - ${pageLabel}` : base
  }, [pageLabel])
}
