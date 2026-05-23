import { cn } from "@/lib/utils"

/** Which standings table the home page is showing. */
export type StandingsView = "players" | "teams"

const TABS: { view: StandingsView; label: string }[] = [
  { view: "players", label: "Players" },
  { view: "teams", label: "Teams" },
]

/**
 * Underline-indicator tab strip that switches between the players and team
 * standings.
 *
 * Modelled as `aria-pressed` toggle buttons rather than the full ARIA tabs
 * pattern (which would also need tabpanel wiring and roving tabindex for no
 * real gain here). The active tab is marked by a brand-blue 2px bottom
 * border; inactive tabs carry a transparent border of the same width so the
 * underline flips on without any layout shift. Labels use the display face
 * (#38) for the same broadcast caps treatment as the table column headers.
 */
export function ViewTabs({
  value,
  onChange,
}: {
  value: StandingsView
  onChange: (view: StandingsView) => void
}) {
  return (
    <div role="group" aria-label="Standings view" className="flex gap-6">
      {TABS.map((tab) => {
        const active = tab.view === value
        return (
          <button
            key={tab.view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.view)}
            className={cn(
              "font-display border-b-2 px-1 py-3 text-base tracking-wider uppercase transition-colors",
              active
                ? "border-brand text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
