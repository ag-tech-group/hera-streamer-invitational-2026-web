import { useEffect } from "react"

import { activeTournament } from "@/config/tournaments"

/**
 * Sets `document.title` for the current page (#178).
 *
 * The base title is `"<tournament name> (<hostLabel>)"` when the build's
 * tournament config carries a `hostLabel`, falling back to just the
 * tournament name when it doesn't. An optional `pageLabel` is appended
 * after `" - "` for sub-routes — `/admin` resolves to
 * `"The King's Gauntlet (Hosted by Hera) - Admin"`, `/` stays at the
 * bare base title.
 *
 * Pages call this once at top level; the underlying `useEffect` re-runs
 * only when `pageLabel` changes, so the typical "stay on one route"
 * case is a one-shot DOM write.
 */
export function useDocumentTitle(pageLabel?: string): void {
  useEffect(() => {
    const base = activeTournament.hostLabel
      ? `${activeTournament.name} (${activeTournament.hostLabel})`
      : activeTournament.name
    document.title = pageLabel ? `${base} - ${pageLabel}` : base
  }, [pageLabel])
}
