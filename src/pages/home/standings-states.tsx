import { Shield, TriangleAlert, Users } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Shared chrome for the empty/error side panels — same elevated card surface as the populated tables, so all three states sit at the same depth on the page. */
const PANEL_CLASS =
  "bg-card shadow-card flex flex-col items-center gap-3 rounded-lg px-6 py-16 text-center"

/**
 * Shown when the standings request succeeds but the leaderboard has no
 * players yet. An expected pre-tournament state — the icon + copy carry
 * the "no data" signal, while the card surface keeps it visually
 * consistent with the populated table.
 */
export function StandingsEmpty() {
  return (
    <div className={PANEL_CLASS}>
      <Users className="text-muted-foreground size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">No standings yet</p>
        <p className="text-muted-foreground text-sm">
          Players will appear here once the tournament leaderboard is populated.
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when the standings request fails. Offers a manual retry; live SSE
 * nudges also re-trigger the request automatically as new data lands.
 */
export function StandingsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={PANEL_CLASS}>
      <TriangleAlert className="text-destructive size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Couldn't load standings</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong reaching the leaderboard.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/**
 * Shown when the team standings request succeeds but no teams are set up
 * for this tournament. Teams are optional, so an empty list is expected;
 * the card surface matches the populated team table at the same depth.
 */
export function TeamsEmpty() {
  return (
    <div className={PANEL_CLASS}>
      <Shield className="text-muted-foreground size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">No teams yet</p>
        <p className="text-muted-foreground text-sm">
          Teams will appear here once they are set up for this tournament.
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when the team standings request fails. Offers a manual retry; live
 * SSE nudges also re-trigger the request automatically as new data lands.
 */
export function TeamsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={PANEL_CLASS}>
      <TriangleAlert className="text-destructive size-8" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Couldn't load teams</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong reaching the team standings.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
