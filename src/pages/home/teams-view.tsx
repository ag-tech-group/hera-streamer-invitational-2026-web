import { Globe } from "lucide-react"
import { useMemo } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { normalizeCountryCode } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TeamMember, TeamStandingsRow } from "@/types"

/**
 * Number of teams above which we no longer pair into a coliseum
 * face-off. With exactly two teams, the layout opens up at 2xl into a
 * side-by-side ALPHA / VS / OMEGA arrangement; with one team or three+
 * it stays stacked banners at every width.
 */
const COLISEUM_TEAM_COUNT = 2

/** Placeholder roster sizes used by the loading skeleton, one per team panel. */
const SKELETON_TEAM_SIZES = [4, 4]

/**
 * Team-colour slot. The tournament is scoped to two teams, so today this
 * is just the AoE2 player-1 (blue) and player-2 (red) palettes. If a
 * third team ever appears we'd extend with the remaining AoE2 player
 * colours (P3 green, P4 yellow, …) rather than letting two teams share
 * a hue.
 */
type TeamColor = "p1" | "p2"

/**
 * Replaces the flat team-standings table (#90) with a roster-first
 * presentation: each team becomes a coloured panel — blue for the first
 * team, red for the second — with the team name + headline stats up top
 * and the roster as a stack of horizontal player pills below.
 *
 * Layout is hybrid: at 2xl+ with exactly two teams the panels sit
 * side-by-side around a VS pillar (the "coliseum" view); below 2xl, or
 * with any other team count, they stack as full-width banners. Either
 * way the inside of each panel is the same — pills reflow via a
 * container query, so a narrow coliseum panel shows one pill per line
 * and a wide banner panel shows several.
 */
/**
 * Subtle team-coloured atmosphere layer behind the Teams view. A pair of
 * wide radial gradients — blue blooming from the left, red from the right —
 * built from the existing `--team-color-bg` tokens (≤ 8% in light, slightly
 * higher in dark to compensate for the darker base) so the page background
 * gets a directional team tint without competing with the data on top.
 *
 * Mirrors the panel colour assignment (lower teamId is P1/blue on the left;
 * higher is P2/red on the right) at any viewport — including stacked layouts
 * below 2xl, where the L/R split still reads as "team space" even though
 * the panels themselves stack vertically.
 *
 * Fixed-positioned at `-z-10` so it sits behind page content but above the
 * body's noise + spotlight backdrop. `aria-hidden` + `pointer-events-none`
 * because it's pure atmosphere — screen readers and pointer interactions
 * walk straight through.
 */
export function TeamsAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          "radial-gradient(ellipse 70vw 80vh at 0% 50%, var(--team-p1-bg), transparent 65%)," +
          "radial-gradient(ellipse 70vw 80vh at 100% 50%, var(--team-p2-bg), transparent 65%)",
      }}
    />
  )
}

export function TeamsView({ rows }: { rows: TeamStandingsRow[] }) {
  // Standings position is the row's index in the API-ranked list (by
  // combined rating, desc). We freeze it into a map up-front so the
  // teamId-sorted display order below doesn't relabel the leader.
  const positionMap = useMemo(() => {
    const map = new Map<number, number>()
    rows.forEach((row, i) => map.set(row.teamId, i + 1))
    return map
  }, [rows])

  // Sort by teamId so colour assignment is stable across renders —
  // otherwise a live rating change that flips the ranking would also
  // flip which side is blue and which is red.
  const teams = useMemo(
    () => [...rows].sort((a, b) => a.teamId - b.teamId),
    [rows]
  )

  const isPair = teams.length === COLISEUM_TEAM_COUNT
  return (
    <TeamsLayout isPair={isPair}>
      {teams.map((team, i) => (
        <TeamPanel
          key={team.teamId}
          team={team}
          color={teamColorFor(i)}
          rank={positionMap.get(team.teamId) ?? 0}
          revealOffset={i * team.members.length}
          className={
            isPair
              ? i === 0
                ? "2xl:col-start-1"
                : "2xl:col-start-3"
              : undefined
          }
        />
      ))}
      {isPair && (
        <VersusPillar className="hidden 2xl:col-start-2 2xl:row-start-1 2xl:flex" />
      )}
    </TeamsLayout>
  )
}

/**
 * Loading placeholder. Mirrors the populated layout's hybrid grid and
 * panel chrome so data arriving doesn't shift the page — the skeleton
 * panels carry the same `data-team-color` tint so the colour treatment
 * is already in place when real rows replace them.
 */
export function TeamsViewSkeleton() {
  return (
    <TeamsLayout isPair>
      {SKELETON_TEAM_SIZES.map((size, i) => (
        <TeamPanelSkeleton
          key={i}
          color={teamColorFor(i)}
          rosterSize={size}
          className={i === 0 ? "2xl:col-start-1" : "2xl:col-start-3"}
        />
      ))}
      <VersusPillar className="hidden 2xl:col-start-2 2xl:row-start-1 2xl:flex" />
    </TeamsLayout>
  )
}

/**
 * Shared grid wrapper for the populated view and the skeleton. The
 * three-column track only activates at 2xl and only with a pair —
 * otherwise it collapses to a single column so each panel takes the
 * full content width.
 *
 * `minmax(0, 1fr)` on the side tracks (instead of bare `1fr`) keeps
 * narrow team names from forcing the grid to overflow on viewports
 * just past the 2xl breakpoint.
 */
function TeamsLayout({
  isPair,
  children,
}: {
  isPair: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        isPair &&
          "2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] 2xl:items-stretch"
      )}
    >
      {children}
    </div>
  )
}

/**
 * Maps a team's display-order index onto the colour slot it occupies.
 * Two-team tournaments get a clean blue/red pair; the alternation
 * fallback for 3+ is best-effort until the palette grows past P1/P2.
 */
function teamColorFor(index: number): TeamColor {
  return index % 2 === 0 ? "p1" : "p2"
}

/**
 * One team's panel — coloured surface carrying the header (name, rank,
 * headline stats) and the roster of player pills. The colour is set
 * via `data-team-color`, which the CSS in `index.css` aliases to the
 * generic `--team-color*` vars that descendants read. That keeps the
 * pill component team-agnostic: same JSX, two colour outcomes.
 */
function TeamPanel({
  team,
  color,
  rank,
  revealOffset,
  className,
}: {
  team: TeamStandingsRow
  color: TeamColor
  rank: number
  /**
   * Starting index for the staggered pill reveal animation — added to
   * each pill's own index so panels reveal in sequence rather than both
   * starting their stagger at zero (which would feel like one shared
   * wave instead of two distinct rosters arriving).
   */
  revealOffset: number
  className?: string
}) {
  // A team is "live" if any roster member is currently in a match. Drives
  // the heartbeat treatment on the accent stripe (see `.team-heartbeat` in
  // index.css) — derived client-side from the per-member `in_match` flag
  // the API already surfaces, no extra endpoint needed.
  const isLive = team.members.some((member) => member.inMatch)
  return (
    <section
      data-team-color={color}
      className={cn(
        "bg-card shadow-card relative overflow-hidden rounded-lg p-6",
        "@container",
        className
      )}
    >
      {/*
       * Atmosphere: a team-coloured accent stripe along the top edge
       * plus a soft glow blooming from the upper-right corner. Both
       * decorative, both keyed to the panel's `--team-color`, so the
       * same JSX paints blue on one panel and red on the other. When the
       * team is live, the stripe picks up the heartbeat-pulse animation.
       */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[3px]",
          isLive && "team-heartbeat"
        )}
        style={{ background: "var(--team-color)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{ background: "var(--team-color-bg)" }}
      />

      <TeamHeader team={team} rank={rank} />
      <PlayerRoster members={team.members} revealOffset={revealOffset} />
    </section>
  )
}

/**
 * Loading-state counterpart of `TeamPanel`. Same chrome, same colour
 * treatment, with skeleton blocks where the live data would go and a
 * configurable roster length so the panel doesn't collapse to nothing
 * before any rows arrive.
 */
function TeamPanelSkeleton({
  color,
  rosterSize,
  className,
}: {
  color: TeamColor
  rosterSize: number
  className?: string
}) {
  return (
    <section
      data-team-color={color}
      className={cn(
        "bg-card shadow-card relative overflow-hidden rounded-lg p-6",
        "@container",
        className
      )}
      aria-busy
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "var(--team-color)" }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-7 w-10" />
      </div>
      <div className="mt-3 flex items-baseline gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-6 grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {Array.from({ length: rosterSize }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    </section>
  )
}

/**
 * Team identity + headline stats at the top of a panel.
 *
 * Average rating is the headline — sum-of-ratings ranks identically when
 * teams are the same size, but reads as a less-meaningful big number, so
 * the panel leads with avg and just notes the roster size beside it.
 */
function TeamHeader({ team, rank }: { team: TeamStandingsRow; rank: number }) {
  const { t } = useTranslation()
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="ring-border inline-flex shrink-0 items-center rounded px-2 py-1 text-xs font-semibold tracking-wide ring-1 ring-inset"
            style={{
              background: "var(--team-color-bg)",
              color: "var(--team-color-strong)",
            }}
          >
            {team.initials}
          </span>
          <h2 className="font-display truncate text-2xl tracking-wide @md:text-3xl">
            {team.name}
          </h2>
        </div>
        <RankBadge rank={rank} />
      </div>
      <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-sm">
        {/*
         * Drops `font-semibold` because Bebas Neue ships only weight 400 —
         * forcing a synthetic 600 emboldens the glyph (same reason the page
         * h1 in home-page.tsx avoids `font-bold`).
         */}
        <span className="font-display text-foreground text-3xl tracking-wide tabular-nums @md:text-4xl">
          {Math.round(team.combinedRatingAverage).toLocaleString()}
        </span>
        <span className="text-xs tracking-widest uppercase">
          {t("teams.average")}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {t("teams.playersCount", { count: team.members.length })}
        </span>
      </p>
    </header>
  )
}

/**
 * Position chip in the corner of each team panel. The leader gets the
 * panel's strong colour at full strength; chasers get the same colour
 * at reduced opacity, so rank reads as a team-identity cue rather than
 * a neutral "you lost" gray. Bebas Neue to match the standings table's
 * broadcast-graphic caps treatment.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return null
  const leader = rank === 1
  return (
    <span
      className="font-display shrink-0 text-2xl leading-none tabular-nums @md:text-3xl"
      style={{
        color: "var(--team-color-strong)",
        opacity: leader ? 1 : 0.55,
      }}
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  )
}

/**
 * The roster grid. Container queries on the parent panel decide how
 * many pills fit per row — narrow (coliseum-column) panels stay at one
 * per row, wide (banner) panels expand up to four. That keeps the same
 * markup working in both layouts without media-query branching.
 *
 * `revealOffset` is added to each pill's own index so the stagger
 * continues across panels in coliseum view rather than firing twice in
 * sync — the eye sees one continuous reveal instead of two simultaneous
 * waves.
 */
function PlayerRoster({
  members,
  revealOffset,
}: {
  members: TeamMember[]
  revealOffset: number
}) {
  const { t } = useTranslation()
  if (members.length === 0) {
    return (
      <p className="text-muted-foreground mt-6 text-sm">
        {t("teams.noMembers")}
      </p>
    )
  }
  return (
    <ul
      className="mt-6 grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4"
      aria-label={t("teams.rosterAriaLabel")}
    >
      {members.map((member, i) => (
        <li
          key={member.profileId}
          className="team-pill-reveal"
          style={{ "--reveal-index": revealOffset + i } as React.CSSProperties}
        >
          <PlayerPill member={member} />
        </li>
      ))}
    </ul>
  )
}

/**
 * One player on a team — a horizontal pill carrying their identity,
 * current rating, and (when applicable) a pulsing "in a live match"
 * indicator. Pulls colour from the panel-level `--team-color` vars via
 * inline styles, so the pill never hard-codes blue or red.
 *
 * Country flag falls back to a globe icon when the country is missing
 * or malformed — same treatment the standings table uses, so the two
 * surfaces stay visually consistent for a given player.
 */
function PlayerPill({ member }: { member: TeamMember }) {
  const countryCode = normalizeCountryCode(member.country)
  return (
    <div className="team-pill flex items-center gap-3 rounded-md border px-3 py-2.5">
      {countryCode ? (
        <span
          className={`fi fi-${countryCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
          title={countryCode.toUpperCase()}
          aria-hidden
        />
      ) : (
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {member.alias}
      </span>
      {member.inMatch && <LiveDot />}
      <span className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
        {member.currentRating}
      </span>
    </div>
  )
}

/**
 * Compact "in a live match" indicator for a team pill — a brand-blue
 * dot with a `ping` halo. Smaller than the standings table's full
 * `LiveBadge` because the pill is tighter on horizontal space; the
 * `sr-only` label preserves the accessible name.
 */
function LiveDot() {
  const { t } = useTranslation()
  return (
    <span
      className="relative flex size-2 shrink-0"
      title={t("standings.liveAriaLabel")}
    >
      <span
        aria-hidden
        className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75"
      />
      <span
        aria-hidden
        className="bg-brand relative inline-flex size-2 rounded-full"
      />
      <span className="sr-only">{t("standings.liveAriaLabel")}</span>
    </span>
  )
}

/**
 * The central pillar between the two team panels in coliseum view. A
 * thin gradient column that fades from one team colour to the other,
 * with a small AoE2-themed keep silhouette + "VS" caption centred
 * vertically. Purely decorative: aria-hidden so screen readers walk
 * straight from one panel to the next.
 */
function VersusPillar({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        "flex w-16 flex-col items-center justify-center",
        className
      )}
      aria-hidden
    >
      <div className="from-team-p1 via-border to-team-p2 h-full w-px bg-gradient-to-b opacity-60" />
      <div className="bg-background ring-border my-3 flex flex-col items-center gap-1 rounded-full px-2 py-3 ring-1">
        <KeepIcon className="text-muted-foreground size-6" />
        <span
          className="font-display text-muted-foreground text-xs tracking-widest"
          aria-label={t("teams.versus")}
        >
          {t("teams.versus")}
        </span>
      </div>
      <div className="from-team-p1 via-border to-team-p2 h-full w-px bg-gradient-to-b opacity-60" />
    </div>
  )
}

/**
 * Three-tower keep silhouette used in the coliseum VS pillar (#114).
 * A custom AoE2-feel mark — taller central donjon flanked by two
 * shorter walls, all topped with crenellations — drawn as a single
 * filled path so it picks up `currentColor` and inverts cleanly
 * between light and dark themes. Sized via the standard `size-*`
 * Tailwind utility, matching the surrounding icon chrome.
 */
function KeepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M3 22 L3 8 L4 8 L4 10 L5 10 L5 8 L6 8 L6 10 L7 10 L7 8 L8 8 L8 10 L9 10 L9 5 L10 5 L10 7 L11 7 L11 5 L13 5 L13 7 L14 7 L14 5 L15 5 L15 10 L16 10 L16 8 L17 8 L17 10 L18 10 L18 8 L19 8 L19 10 L20 10 L20 8 L21 8 L21 22 Z" />
    </svg>
  )
}
