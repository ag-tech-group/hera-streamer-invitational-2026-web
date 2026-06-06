import type { ReactNode } from "react"

import type { SortDirection, SortState } from "@/hooks/use-table-sort"
import { type TeamColorSlot } from "@/lib/team-colors"
import {
  LastMatchCell,
  PlayerCell,
  RecentMatchupsCell,
  StreakCell,
  TeamCell,
  WatchCell,
  WatchMetric,
  WinPctCell,
} from "@/pages/home/standings-cells"
import type { StandingsRow } from "@/types"

/**
 * Column config shared by the desktop table and the mobile list/sort-bar.
 *
 * The sort STATE has a single source of truth in `useTableSort`; this module is
 * the single source of truth for the static per-column config that drives the
 * two views' chrome — the field list the mobile bar offers, each field's natural
 * starting direction, which metric the collapsed row echoes, and the rich rows
 * the expanded panel shows.
 */

/**
 * Stable per-row identifier for React keys, FLIP tracking, and the position
 * map. Keys on `tournamentPlayerId` — the roster's first-class identity (#281),
 * non-null for every row including an unlinked entrant whose `profileId` hasn't
 * minted yet — so one key shape covers the whole table.
 */
export function rowKey(row: StandingsRow): string {
  return String(row.tournamentPlayerId)
}

/** Context every cell renderer here needs but can't read off a single row. */
export interface CellContext {
  /** One reference instant for the whole render, so every "time ago" agrees. */
  now: Date
  /** teamId → creation-order colour slot (#231), built at the table level. */
  colorByTeamId: Map<number, TeamColorSlot>
}

export interface SortableColumn {
  key: string
  /** i18n key for the display label — shared with the desktop header. */
  headerKey: string
  defaultDirection: SortDirection
}

/**
 * Every sortable column, in the order the mobile sort bar lists them. Mirrors
 * the desktop header's sortable `<th>`s — same keys, same default directions
 * (string-ish columns start `asc`, magnitude columns `desc`). Keep in lockstep
 * with `StandingsHeaderRow` in `standings-table.tsx`.
 */
export const SORTABLE_COLUMNS: SortableColumn[] = [
  { key: "team", headerKey: "standings.headers.team", defaultDirection: "asc" },
  {
    key: "alias",
    headerKey: "standings.headers.player",
    defaultDirection: "asc",
  },
  {
    key: "maxRating",
    headerKey: "standings.headers.peak",
    defaultDirection: "desc",
  },
  {
    key: "currentRating",
    headerKey: "standings.headers.rating",
    defaultDirection: "desc",
  },
  {
    key: "gamesPlayed",
    headerKey: "standings.headers.games",
    defaultDirection: "desc",
  },
  {
    key: "winPct",
    headerKey: "standings.headers.winPct",
    defaultDirection: "desc",
  },
  {
    key: "streak",
    headerKey: "standings.headers.streak",
    defaultDirection: "desc",
  },
  {
    key: "lastMatchAt",
    headerKey: "standings.headers.lastMatch",
    defaultDirection: "desc",
  },
  {
    key: "watch",
    headerKey: "standings.headers.watch",
    defaultDirection: "desc",
  },
]

const DEFAULT_DIRECTION = new Map(
  SORTABLE_COLUMNS.map((c) => [c.key, c.defaultDirection])
)

/** A column's declared starting direction, defaulting to `desc` if unknown. */
export function defaultDirectionFor(key: string): SortDirection {
  return DEFAULT_DIRECTION.get(key) ?? "desc"
}

/** Muted em-dash for an empty numeric value, matching the table's cells. */
function numberOrDash(value: number | null): ReactNode {
  return value === null ? (
    <span className="text-muted-foreground text-xs">—</span>
  ) : (
    value
  )
}

/** The metric whose value the collapsed mobile row shows on its trailing edge. */
export interface MetricColumn {
  key: string
  headerKey: string
  /** Compact, NON-interactive — it renders inside the row's expand button. */
  render: (row: StandingsRow, ctx: CellContext) => ReactNode
}

const METRIC_COLUMNS: Record<string, MetricColumn> = {
  maxRating: {
    key: "maxRating",
    headerKey: "standings.headers.peak",
    render: (r) => numberOrDash(r.maxRating),
  },
  currentRating: {
    key: "currentRating",
    headerKey: "standings.headers.rating",
    render: (r) => numberOrDash(r.currentRating),
  },
  gamesPlayed: {
    key: "gamesPlayed",
    headerKey: "standings.headers.games",
    render: (r) => r.gamesPlayed,
  },
  winPct: {
    key: "winPct",
    headerKey: "standings.headers.winPct",
    render: (r) =>
      r.winPct === null ? (
        <span className="text-muted-foreground text-xs">—</span>
      ) : (
        `${r.winPct.toFixed(1)}%`
      ),
  },
  streak: {
    key: "streak",
    headerKey: "standings.headers.streak",
    render: (r) => <StreakCell streak={r.streak} />,
  },
  team: {
    key: "team",
    headerKey: "standings.headers.team",
    render: (r, ctx) => (
      <TeamCell
        team={r.team}
        colorSlot={r.team ? ctx.colorByTeamId.get(r.team.teamId) : undefined}
      />
    ),
  },
  lastMatchAt: {
    key: "lastMatchAt",
    headerKey: "standings.headers.lastMatch",
    render: (r, ctx) => (
      <LastMatchCell lastMatchAt={r.lastMatchAt} now={ctx.now} />
    ),
  },
  watch: {
    key: "watch",
    headerKey: "standings.headers.watch",
    render: (r) => (
      <WatchMetric
        streamUrls={r.presentation.streamUrls}
        streamLive={r.streamLive}
        streamCategory={r.streamCategory}
      />
    ),
  },
}

/**
 * Resolve which metric the collapsed row echoes for the current sort:
 * - no active sort (the default peak-ranked order) → Peak.
 * - sorted by player name → Peak too; echoing the name beside the name column
 *   would just be noise.
 * - otherwise → the sorted field itself.
 */
export function metricForSort(sortState: SortState | null): MetricColumn {
  const key = sortState?.key ?? "maxRating"
  if (key === "alias") return METRIC_COLUMNS.maxRating
  return METRIC_COLUMNS[key] ?? METRIC_COLUMNS.maxRating
}

/** A label/value cell in the expanded detail panel. */
export interface DetailItem {
  key: string
  headerKey: string
  /** Spans both columns of the panel grid (wide content: identity, pips, links). */
  wide?: boolean
  /** RICH/interactive — the panel is a sibling of, not inside, the row button. */
  render: (row: StandingsRow, ctx: CellContext) => ReactNode
}

/**
 * The expanded panel's rows, in display order — the full desktop column set
 * minus Position (the collapsed row already carries the rank). The scalar
 * stats lay out two-up (Last match pairs with Watch); the wide rows
 * (`wide: true`) span the full width: the identity block at the top (so the
 * player name is tappable through to their profile, which the slim collapsed
 * row — being one big expand button — can't expose) and the recent-form pips
 * at the bottom. These use the rich, interactive cells since the panel is a
 * sibling of, not inside, the row's button.
 */
export const DETAIL_ITEMS: DetailItem[] = [
  {
    key: "player",
    headerKey: "standings.headers.player",
    wide: true,
    render: (r) => (
      <PlayerCell
        profileId={r.profileId}
        name={r.name}
        alias={r.alias}
        displayName={r.presentation.displayName}
        country={r.country}
        flagOverride={r.presentation.flag}
        bio={r.presentation.bio}
        profileUrl={r.presentation.profileUrl}
        inMatch={r.inMatch}
      />
    ),
  },
  {
    key: "team",
    headerKey: "standings.headers.team",
    render: (r, ctx) => (
      <TeamCell
        team={r.team}
        colorSlot={r.team ? ctx.colorByTeamId.get(r.team.teamId) : undefined}
      />
    ),
  },
  {
    key: "maxRating",
    headerKey: "standings.headers.peak",
    render: (r) => numberOrDash(r.maxRating),
  },
  {
    key: "currentRating",
    headerKey: "standings.headers.rating",
    render: (r) => numberOrDash(r.currentRating),
  },
  {
    key: "gamesPlayed",
    headerKey: "standings.headers.games",
    render: (r) => r.gamesPlayed,
  },
  {
    key: "winPct",
    headerKey: "standings.headers.winPct",
    render: (r) => (
      <WinPctCell winPct={r.winPct} wins={r.wins} losses={r.losses} />
    ),
  },
  {
    key: "streak",
    headerKey: "standings.headers.streak",
    render: (r) => <StreakCell streak={r.streak} />,
  },
  {
    key: "lastMatchAt",
    headerKey: "standings.headers.lastMatch",
    render: (r, ctx) => (
      <LastMatchCell lastMatchAt={r.lastMatchAt} now={ctx.now} />
    ),
  },
  {
    key: "watch",
    headerKey: "standings.headers.watch",
    render: (r) => (
      <WatchCell
        streamUrls={r.presentation.streamUrls}
        streamLive={r.streamLive}
        streamTitle={r.streamTitle}
        streamCategory={r.streamCategory}
        profileId={r.profileId}
        alias={r.alias}
      />
    ),
  },
  {
    key: "recent",
    headerKey: "standings.headers.recent",
    wide: true,
    render: (r, ctx) => (
      <RecentMatchupsCell matchups={r.recentMatchups} now={ctx.now} />
    ),
  },
]
