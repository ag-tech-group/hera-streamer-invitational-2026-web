import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

/** One toggleable entry: a series' display name (the toggle key) + its colour. */
export interface ChartLegendItem {
  /** echarts series name — also the React key and toggle key. Assumed unique. */
  name: string
  /** The series' line / marker colour, shown as the pill's dot. */
  color: string
}

/** A team's identity + base hue, for the team bulk-toggle pills. */
export interface ChartTeam {
  teamId: number
  /** Display label shown on the pill (e.g. "Team Thermal"). */
  name: string
  /** Team base colour (hex), shown as the pill's dot and active accent. */
  color: string
}

/** A team pill's data: team identity plus the series names it toggles together. */
export interface ChartLegendTeam extends ChartTeam {
  /** Legend item names (series names) of this team's players present in the chart. */
  memberNames: string[]
}

/**
 * Shared HTML legend for the stats line charts (rating + position), replacing
 * echarts' canvas legend (#326). The canvas legend wrapped by pixel width, so a
 * wide window crammed the whole roster onto one overflowing row that clipped at
 * the edges, and its selector buttons could only approximate the civ-card pills.
 * In HTML we get the real design tokens (theme-aware brand pills, hover states),
 * a responsive grid that caps the names at ten per row, and no clipping.
 *
 * Controlled + presentational: selection is owned by the chart component and
 * pushed into echarts through `legend.selected`, so this holds no state — it
 * renders the pills and reports clicks. (A missing `selected` entry counts as
 * shown, matching echarts' default, so the initial empty map shows everyone.)
 */
export function ChartLegend({
  items,
  selected,
  onToggle,
  onAll,
  onInvert,
  teams,
  onToggleTeam,
}: {
  items: ChartLegendItem[]
  /** name → shown? A missing entry counts as shown (echarts' default). */
  selected: Record<string, boolean>
  onToggle: (name: string) => void
  onAll: () => void
  onInvert: () => void
  /** Team bulk-toggle pills; omit (or empty) to hide the team row entirely. */
  teams?: ChartLegendTeam[]
  /** Toggle every player on `team` at once (show all if any are hidden). */
  onToggleTeam?: (team: ChartLegendTeam) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 space-y-2">
      {/* Bulk actions — All / Invert, then one pill per team (toggle a whole
          roster at once). Brand-tinted / team-tinted so they read as the
          controls ahead of the neutral per-player name pills. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionPill onClick={onAll}>{t("stats.legend.all")}</ActionPill>
        <ActionPill onClick={onInvert}>{t("stats.legend.invert")}</ActionPill>
        {teams && teams.length > 0 ? (
          <>
            {/* Divider so the team toggles read as a distinct group. */}
            <span aria-hidden className="bg-border mx-0.5 h-4 w-px shrink-0" />
            {teams.map((team) => (
              <TeamPill
                key={team.teamId}
                team={team}
                // Lit only while every one of the team's players is visible, so
                // turning any single player off dims it. Clicking a dim pill
                // shows the whole team; clicking a lit (full) one hides it.
                active={team.memberNames.every((n) => selected[n] !== false)}
                onClick={() => onToggleTeam?.(team)}
              />
            ))}
          </>
        ) : null}
      </div>
      {/* Name toggles — a responsive grid, hard-capped at ten columns so the
          roster stays a couple of tidy rows instead of one clipping line. */}
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-10">
        {items.map((it) => {
          const on = selected[it.name] !== false
          return (
            <li key={it.name} className="min-w-0">
              <button
                type="button"
                onClick={() => onToggle(it.name)}
                aria-pressed={on}
                title={it.name}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-border text-foreground hover:bg-muted/60"
                    : "border-border/40 text-muted-foreground/50 hover:bg-muted/40"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full transition-opacity",
                    on ? "opacity-100" : "opacity-30"
                  )}
                  style={{ backgroundColor: it.color }}
                />
                <span className="min-w-0 truncate">{it.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A bulk-action pill (All / Invert), styled as a brand-tinted civ-card chip. */
function ActionPill({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-brand/30 text-brand hover:bg-brand/10 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
    >
      {children}
    </button>
  )
}

/**
 * A team bulk-toggle pill: shows/hides a whole roster at once. Carries the team
 * hue on its dot, and — when active — on its border and label too, so the teams
 * read apart from the brand-tinted All/Invert and the neutral per-player pills.
 * Dims when none of the team's players are visible.
 */
function TeamPill({
  team,
  active,
  onClick,
}: {
  team: ChartLegendTeam
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={team.name}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "hover:bg-muted/60"
          : "border-border/40 text-muted-foreground/50 hover:bg-muted/40"
      )}
      // Active pills paint their border + label in the team hue (dynamic, so
      // inline rather than a Tailwind class); inactive falls back to the muted
      // classes above.
      style={
        active ? { borderColor: team.color, color: team.color } : undefined
      }
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full transition-opacity"
        style={{ backgroundColor: team.color, opacity: active ? 1 : 0.3 }}
      />
      <span className="min-w-0 truncate">{team.name}</span>
    </button>
  )
}
