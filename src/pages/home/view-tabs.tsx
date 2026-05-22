import { cn } from "@/lib/utils"

/** Which standings table the home page is showing. */
export type StandingsView = "players" | "teams"

const TABS: { view: StandingsView; label: string }[] = [
  { view: "players", label: "Players" },
  { view: "teams", label: "Teams" },
]

/**
 * Segmented control that switches the home page between the players standings
 * and the team standings.
 *
 * A two-option view switch, modelled as a pair of `aria-pressed` toggle
 * buttons rather than the full ARIA tabs pattern — which would also require
 * tabpanel wiring and roving-tabindex keyboard navigation for no real gain
 * here.
 */
export function ViewTabs({
  value,
  onChange,
}: {
  value: StandingsView
  onChange: (view: StandingsView) => void
}) {
  return (
    <div
      role="group"
      aria-label="Standings view"
      className="bg-muted inline-flex gap-1 self-start rounded-lg p-1"
    >
      {TABS.map((tab) => {
        const active = tab.view === value
        return (
          <button
            key={tab.view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.view)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
