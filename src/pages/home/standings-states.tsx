import { TriangleAlert, Users } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Shown when the standings request succeeds but the leaderboard has no players
 * yet. An expected pre-tournament state, not a failure — hence the softer,
 * dashed treatment.
 */
export function StandingsEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
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
    <div className="flex flex-col items-center gap-3 rounded-lg border px-6 py-16 text-center">
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
