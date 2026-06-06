import { Globe, Shield, Swords } from "lucide-react"
import { useMemo } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { flagEmojiToCountryCode, normalizeCountryCode } from "@/lib/format"
import {
  TEAM_COLOR_SLOTS,
  teamColorMap,
  type TeamColorSlot,
} from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import { PlayerName } from "@/pages/home/player-name"
import type { TeamMember, TeamStandingsRow } from "@/types"

/**
 * Number of teams above which we no longer pair into a coliseum
 * face-off. With exactly two teams, the layout opens up at xl into a
 * side-by-side ALPHA / VS / OMEGA arrangement; with one team or three+
 * it stays stacked banners at every width.
 */
const COLISEUM_TEAM_COUNT = 2

/**
 * Placeholder roster sizes for the loading skeleton, one entry per team panel.
 * This build runs 4 teams (> 2) of 5 players each, so the populated view uses
 * the stacked-banner layout (the coliseum is a 2-team-only arrangement) and the
 * skeleton matches it — 4 stacked panels of 5 pills — so data arriving doesn't
 * shift the layout.
 */
const SKELETON_TEAM_SIZES = [5, 5, 5, 5]

/**
 * Replaces the flat team-standings table (#90) with a roster-first
 * presentation: each team becomes a coloured panel — blue for the first
 * team, red for the second — with the team name + headline stats up top
 * and the roster as a stack of horizontal player pills below.
 *
 * Layout is hybrid: at xl+ with exactly two teams the panels sit
 * side-by-side around a VS pillar (the "coliseum" view); below xl, or
 * with any other team count, they stack as full-width banners. Either
 * way the inside of each panel is the same — pills reflow via a
 * container query, so a narrow coliseum panel shows one pill per line
 * and a wide banner panel shows several.
 */
/** tournamentPlayerId → resolved display label (override else the unified
 *  `name`, #187), sourced from the players standings since the team-standings
 *  endpoint carries no display label. Keyed on tournamentPlayerId so an unlinked
 *  entrant (null profileId) joins identically to a linked one (#281). */
type DisplayNameMap = Map<number, string>

/** tournamentPlayerId → host flag override (presentation.flag), likewise passed
 *  down from the players standings: team-standings members carry only the raw
 *  `country`. */
type FlagMap = Map<number, string>

/** tournamentPlayerId → host profile link (presentation.profileUrl, #131),
 *  threaded down so the pill's name links through exactly like the table's —
 *  the team-standings payload carries no profile URL (#350). */
type ProfileUrlMap = Map<number, string>

/** tournamentPlayerId → host bio (presentation.bio), threaded down so the pill
 *  shows the same bio disclosure the players table does (#350). */
type BioMap = Map<number, string>

export function TeamsView({
  rows,
  displayNameByTournamentPlayerId,
  flagByTournamentPlayerId,
  // Profile-URL + bio enrich the pill's name (#350); they default to empty so a
  // caller (or test) that only cares about names/flags can omit them and the
  // pill simply renders plain, bio-less names.
  profileUrlByTournamentPlayerId = new Map(),
  bioByTournamentPlayerId = new Map(),
}: {
  rows: TeamStandingsRow[]
  displayNameByTournamentPlayerId: DisplayNameMap
  flagByTournamentPlayerId: FlagMap
  profileUrlByTournamentPlayerId?: ProfileUrlMap
  bioByTournamentPlayerId?: BioMap
}) {
  // Panels display in rank order — the API returns `rows` ranked by combined
  // rating, desc, so the incoming order IS the ranking (#230). Position is
  // therefore just the row index + 1.
  //
  // Colour is keyed to team identity via `teamColorMap` (creation order, #231),
  // NOT the display position, so a team keeps its colour as it moves up or down
  // the ranking on a live update — only the panel order changes, never the
  // blue/red/green assignment.
  const colorByTeamId = useMemo(
    () => teamColorMap(rows.map((r) => r.teamId)),
    [rows]
  )

  const isPair = rows.length === COLISEUM_TEAM_COUNT
  return (
    <TeamsLayout isPair={isPair}>
      {rows.map((team, i) => (
        <TeamPanel
          key={team.teamId}
          team={team}
          color={colorByTeamId.get(team.teamId) ?? TEAM_COLOR_SLOTS[0]}
          rank={i + 1}
          revealOffset={i * team.members.length}
          displayNameByTournamentPlayerId={displayNameByTournamentPlayerId}
          flagByTournamentPlayerId={flagByTournamentPlayerId}
          profileUrlByTournamentPlayerId={profileUrlByTournamentPlayerId}
          bioByTournamentPlayerId={bioByTournamentPlayerId}
          className={
            isPair ? (i === 0 ? "xl:col-start-1" : "xl:col-start-3") : undefined
          }
        />
      ))}
      {isPair && (
        <VersusPillar className="hidden xl:col-start-2 xl:row-start-1 xl:flex" />
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
    <TeamsLayout isPair={false}>
      {SKELETON_TEAM_SIZES.map((size, i) => (
        <TeamPanelSkeleton
          key={i}
          color={TEAM_COLOR_SLOTS[i]}
          rosterSize={size}
        />
      ))}
    </TeamsLayout>
  )
}

/**
 * Shared grid wrapper for the populated view and the skeleton. The
 * three-column track only activates at xl and only with a pair —
 * otherwise it collapses to a single column so each panel takes the
 * full content width.
 *
 * `minmax(0, 1fr)` on the side tracks (instead of bare `1fr`) keeps
 * narrow team names from forcing the grid to overflow on viewports
 * just past the xl breakpoint.
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
          "xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-stretch"
      )}
    >
      {children}
    </div>
  )
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
  displayNameByTournamentPlayerId,
  flagByTournamentPlayerId,
  profileUrlByTournamentPlayerId,
  bioByTournamentPlayerId,
  className,
}: {
  team: TeamStandingsRow
  color: TeamColorSlot
  rank: number
  /**
   * Starting index for the staggered pill reveal animation — added to
   * each pill's own index so panels reveal in sequence rather than both
   * starting their stagger at zero (which would feel like one shared
   * wave instead of two distinct rosters arriving).
   */
  revealOffset: number
  displayNameByTournamentPlayerId: DisplayNameMap
  flagByTournamentPlayerId: FlagMap
  profileUrlByTournamentPlayerId: ProfileUrlMap
  bioByTournamentPlayerId: BioMap
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
        className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{ background: "var(--team-color-bg)" }}
      />

      <TeamHeader team={team} rank={rank} />
      <PlayerRoster
        members={team.members}
        revealOffset={revealOffset}
        displayNameByTournamentPlayerId={displayNameByTournamentPlayerId}
        flagByTournamentPlayerId={flagByTournamentPlayerId}
        profileUrlByTournamentPlayerId={profileUrlByTournamentPlayerId}
        bioByTournamentPlayerId={bioByTournamentPlayerId}
      />
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
  color: TeamColorSlot
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
      <div className="mt-6 grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5">
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
 * Combined **peak** sum is the headline (#242, peak-based since API #158) —
 * it's the metric teams are actually ranked by, so the big number matches the
 * order and the rank badge, and the per-player peaks in the pills below sum to
 * it. Roster size is noted beside it.
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
          {Math.round(team.combinedRatingSum).toLocaleString()}
        </span>
        <span className="text-xs tracking-widest uppercase">
          {t("teams.sum")}
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
 *
 * Leads with a small "RANK" caption: in AoE2 a bare "#1" reads as a player
 * *colour* (colours are numbered 1–8), so the label disambiguates that this
 * is standings position, not the blue/red team slot.
 */
function RankBadge({ rank }: { rank: number }) {
  const { t } = useTranslation()
  if (rank === 0) return null
  const leader = rank === 1
  return (
    <span
      className="flex shrink-0 items-baseline gap-1"
      style={{
        color: "var(--team-color-strong)",
        opacity: leader ? 1 : 0.55,
      }}
      aria-label={t("teams.rankAria", { rank })}
    >
      <span
        aria-hidden
        className="text-[10px] font-semibold tracking-widest uppercase"
      >
        {t("teams.rankLabel")}
      </span>
      <span
        aria-hidden
        className="font-display text-2xl leading-none tabular-nums @md:text-3xl"
      >
        #{rank}
      </span>
    </span>
  )
}

/**
 * The roster grid. Container queries on the parent panel decide how
 * many pills fit per row — narrow (coliseum-column) panels stay at one
 * per row, wide (banner) panels expand up to five so a full 5-player
 * roster sits on one row instead of wrapping 4 + a lonely 1. That keeps
 * the same markup working in both layouts without media-query branching.
 *
 * `revealOffset` is added to each pill's own index so the stagger
 * continues across panels in coliseum view rather than firing twice in
 * sync — the eye sees one continuous reveal instead of two simultaneous
 * waves.
 */
function PlayerRoster({
  members,
  revealOffset,
  displayNameByTournamentPlayerId,
  flagByTournamentPlayerId,
  profileUrlByTournamentPlayerId,
  bioByTournamentPlayerId,
}: {
  members: TeamMember[]
  revealOffset: number
  displayNameByTournamentPlayerId: DisplayNameMap
  flagByTournamentPlayerId: FlagMap
  profileUrlByTournamentPlayerId: ProfileUrlMap
  bioByTournamentPlayerId: BioMap
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
      className="mt-6 grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5"
      aria-label={t("teams.rosterAriaLabel")}
    >
      {members.map((member, i) => {
        // Join the host overrides by tournamentPlayerId — present even for an
        // unlinked entrant (profileId is null there) — so the flag, name,
        // profile link, and bio show on the team pill just like on the standings
        // table.
        const id = member.tournamentPlayerId
        return (
          <li
            key={id}
            className="team-pill-reveal"
            style={
              { "--reveal-index": revealOffset + i } as React.CSSProperties
            }
          >
            <PlayerPill
              member={member}
              displayName={displayNameByTournamentPlayerId.get(id)}
              flagOverride={flagByTournamentPlayerId.get(id)}
              profileUrl={profileUrlByTournamentPlayerId.get(id)}
              bio={bioByTournamentPlayerId.get(id)}
            />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * One player on a team — a pill carrying their identity, peak rating, and (when
 * applicable) a pulsing "in a live match" indicator. The peak (not current)
 * rating is shown because it's what the team's combined headline sums (API
 * #158), so the pills add up to the number above them. Pulls colour from the
 * panel-level `--team-color` vars via inline styles, so the pill never
 * hard-codes blue or red.
 *
 * Country flag falls back to a globe icon when the country is missing or
 * malformed — same treatment the standings table uses, so the two surfaces stay
 * visually consistent for a given player.
 *
 * The name itself is the shared `PlayerName` (#350) — the same profile link
 * (#131) and bio disclosure the players table renders, so the two can't drift.
 * It shows the resolved display label (#242, #187: the host's display-name
 * override else the unified `name`); the label, profile URL, and bio aren't on
 * the team-standings payload, so they're all passed down from the players
 * standings by tournamentPlayerId.
 *
 * On mobile the captain badge (when present) breaks to its own row above the
 * name, so the fixed-width badge can't crowd the name + bio button on a narrow
 * pill; at `sm`+ it collapses inline — flag · name · captain · live · rating —
 * for the roomier desktop layout (#350).
 */
function PlayerPill({
  member,
  displayName,
  flagOverride,
  profileUrl,
  bio,
}: {
  member: TeamMember
  displayName: string | undefined
  flagOverride: string | undefined
  profileUrl: string | undefined
  bio: string | undefined
}) {
  const countryCode = normalizeCountryCode(member.country)
  // Host flag override (presentation.flag), passed down from the players
  // standings since team-standings members carry only the raw `country`.
  // Mirrors the standings table: a standard flag emoji decomposes to an ISO
  // code and renders via the SVG `flag-icons` pipeline; a non-standard glyph
  // (rainbow, regional tag, …) falls through to text; otherwise the raw country.
  const overrideCode = flagOverride
    ? flagEmojiToCountryCode(flagOverride)
    : null
  const effectiveFlagCode = overrideCode ?? countryCode
  const renderOverrideAsText = Boolean(flagOverride && !overrideCode)
  // The resolved display label (override else the unified `name`, #187) is
  // joined from standings by tournamentPlayerId (#281), so every roster member
  // — an unlinked entrant included — shows a real name. `member.alias ?? "—"`
  // only backstops a member somehow absent from standings.
  const visibleName = displayName ?? member.alias ?? "—"
  return (
    // One flex row that wraps on mobile so the captain badge can take its own
    // full-width line above the name (`basis-full`, below); `sm:flex-nowrap`
    // keeps the desktop row on a single line (the name truncates to fit instead
    // of wrapping). `h-full` keeps pills height-matched in the grid. `text-sm`
    // sets the row's type scale, which the shared `PlayerName` inherits.
    <div className="team-pill flex h-full flex-wrap content-center items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2.5 text-sm sm:flex-nowrap">
      {effectiveFlagCode ? (
        <span
          className={`fi fi-${effectiveFlagCode} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
          title={effectiveFlagCode.toUpperCase()}
          aria-hidden
        />
      ) : renderOverrideAsText ? (
        <span
          className="shrink-0 text-base leading-none"
          aria-label={visibleName}
        >
          {flagOverride}
        </span>
      ) : (
        <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
      <PlayerName
        name={visibleName}
        alias={member.alias}
        profileId={member.profileId}
        bio={bio}
        profileUrl={profileUrl}
        source="teams"
        truncate
      />
      {member.isCaptain && (
        // Captain badge: its own full-width line above the name on mobile
        // (`basis-full` forces the wrap; the `flex` wrapper keeps the chip
        // content-sized at the start rather than stretching). At `sm`+
        // `sm:contents` dissolves this wrapper so the badge flows inline in DOM
        // order — flag · name · captain · live · rating — for desktop (#350).
        <div className="order-first flex basis-full sm:contents">
          <CaptainBadge />
        </div>
      )}
      {member.inMatch && <LiveDot />}
      <span className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
        {member.peakRating ?? "—"}
      </span>
    </div>
  )
}

/**
 * "Captain" badge for the team's captain (#235). Shield glyph + label in the
 * team's own colour, reading off the panel-level `--team-color` vars like the
 * rest of the pill so it tints blue/red/green per team. Teams view only —
 * never shown on the per-player standings list.
 */
function CaptainBadge() {
  const { t } = useTranslation()
  return (
    <span
      className="ring-border inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset"
      style={{
        background: "var(--team-color-bg)",
        color: "var(--team-color-strong)",
      }}
      title={t("teams.captain")}
    >
      <Shield className="size-2.5" aria-hidden />
      {t("teams.captain")}
    </span>
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
 * with crossed swords + a "VS" caption centred vertically. Purely
 * decorative: aria-hidden so screen readers walk straight from one
 * panel to the next.
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
        <Swords className="text-muted-foreground size-5" />
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
