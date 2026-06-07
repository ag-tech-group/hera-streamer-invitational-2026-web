import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RecentMatchup } from "@/types"

/**
 * Accessible name for a recent-form pip, e.g. "Won as Franks vs Mayans" — the
 * at-a-glance W/L plus the civ matchup, so a screen reader hears the same story
 * the visual card tells. Falls back to the player's civ alone when the opponent
 * civ is unknown, and to a generic "an unknown civ" when even the player's civ
 * didn't resolve.
 */
function matchupAriaLabel(matchup: RecentMatchup, t: TFunction): string {
  const outcome =
    matchup.outcome === "win"
      ? t("standings.recentMatchup.won")
      : t("standings.recentMatchup.lost")
  const civ = matchup.civName ?? t("standings.recentMatchup.unknownCiv")
  return matchup.opponentCivName
    ? t("standings.recentMatchup.labelVs", {
        outcome,
        civ,
        opponent: matchup.opponentCivName,
      })
    : t("standings.recentMatchup.labelSolo", { outcome, civ })
}

/** A civ in the matchup card: its heraldic emblem (or a held slot) and name. */
function CivChip({
  name,
  emblemUrl,
}: {
  name: string | null
  emblemUrl: string | null
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {emblemUrl ? (
        <img
          src={emblemUrl}
          alt=""
          loading="lazy"
          className="size-5 shrink-0"
        />
      ) : (
        // Held slot keeps the name aligned with emblem'd chips when we have no
        // shield (a civ newer than our snapshot, or an unresolved name).
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <span className="whitespace-nowrap">{name ?? "—"}</span>
    </span>
  )
}

/**
 * One side of the matchup: the player's name (#349) over their civ chip, so the
 * card reads "who, as which civ" top to bottom. The `name` node is passed in so
 * the caller controls its treatment (plain for the player, a brand-highlighted
 * link for a fellow-streamer opponent); the outcome heading and the
 * left-is-player layout already say which side is which, so the names stand on
 * their own without a "Player" / "Opponent" caption.
 */
function MatchSide({
  name,
  civName,
  civEmblemUrl,
}: {
  name: ReactNode
  civName: string | null
  civEmblemUrl: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {name}
      <CivChip name={civName} emblemUrl={civEmblemUrl} />
    </div>
  )
}

/**
 * The opponent's name in the matchup card (#349). Always shown; a fellow
 * tournament streamer (`opponentIsStreamer`) is highlighted brand and, when
 * their row carries a host profile URL, linked to it — the same treatment a
 * player name gets in the standings, so a clash with another streamer reads as
 * one. A regular ladder opponent is plain text, and a missing name degrades to
 * an em dash.
 */
function OpponentName({ matchup }: { matchup: RecentMatchup }) {
  const { t } = useTranslation()
  const name = matchup.opponentName
  if (!name) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  if (!matchup.opponentIsStreamer) {
    return <span className="truncate text-sm font-medium">{name}</span>
  }
  if (matchup.opponentProfileUrl) {
    return (
      <a
        href={matchup.opponentProfileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t("standings.viewProfile", { name })}
        className="text-brand truncate text-sm font-medium underline-offset-2 transition hover:underline"
      >
        {name}
      </a>
    )
  }
  // A fellow streamer we have no profile link for: highlight without a link, and
  // name the highlight for assistive tech (brand colour alone isn't a signal).
  return (
    <span
      className="text-brand truncate text-sm font-medium"
      title={t("standings.recentMatchup.streamerHint")}
    >
      {name}
    </span>
  )
}

/**
 * The civ-matchup card body (#339): an outcome-coloured heading (Won/Lost) over
 * the player `vs` the opponent — each side a name (#349) above its labelled
 * heraldic emblem + civ name — then a muted "map · time ago" context line. The
 * opponent's name is highlighted + linked when they're a fellow streamer. Mirrors
 * the dotted-heading structure of the sibling standings tooltips (`BioCard`,
 * `WinLossBreakdown`, `WatchCard`) so the family reads as one.
 */
function MatchupCard({
  matchup,
  playerName,
  now,
}: {
  matchup: RecentMatchup
  /** The row player's display name — shown on the left side of the matchup. */
  playerName: string
  now: Date
}) {
  const { t } = useTranslation()
  const won = matchup.outcome === "win"
  const heading = won
    ? t("standings.recentMatchup.won")
    : t("standings.recentMatchup.lost")
  // "Arabia · 3h ago" — drop whichever half the API didn't give us (an empty
  // cleaned map, or a null completion time) rather than render a dangling dot.
  const context = [
    matchup.mapName,
    matchup.completedAt ? formatTimeAgo(matchup.completedAt, now) : "",
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            won ? "bg-chart-2" : "bg-destructive"
          )}
        />
        <p
          className={cn(
            "text-sm font-semibold",
            won ? "text-chart-2-deep" : "text-destructive-deep"
          )}
        >
          {heading}
        </p>
      </div>
      {/* Bottom-aligned so the "vs" sits on the civ row, level with both chips. */}
      <div className="flex items-end gap-2 text-sm">
        <MatchSide
          name={
            <span className="truncate text-sm font-medium">{playerName}</span>
          }
          civName={matchup.civName}
          civEmblemUrl={matchup.civEmblemUrl}
        />
        <span className="text-muted-foreground shrink-0 pb-0.5 text-xs tracking-wide uppercase">
          {t("standings.recentMatchup.vs")}
        </span>
        <MatchSide
          name={<OpponentName matchup={matchup} />}
          civName={matchup.opponentCivName}
          civEmblemUrl={matchup.opponentCivEmblemUrl}
        />
      </div>
      {context ? (
        <p className="text-muted-foreground text-xs">{context}</p>
      ) : null}
    </div>
  )
}

/**
 * Wraps a recent-form pip (`children`) in its civ-matchup disclosure (#339): on
 * a mouse the pip's hover floats the card; on touch a tap opens the same card as
 * a popover. The pip has no other action, so the tap is free to own the
 * disclosure (unlike the bio, where a tap follows the name's link and a separate
 * info icon is needed). Both primitives portal their content, so it floats clear
 * of the standings table's FLIP transforms on a live re-sort, and the shared
 * `tooltip-surface` chrome makes it one family with `BioHint` / `WinPctHint` /
 * `WatchHint`.
 */
export function RecentMatchupHint({
  matchup,
  playerName,
  now,
  hoverCapable,
  children,
}: {
  matchup: RecentMatchup
  /** The row player's display name — shown as the "Player" side of the card (#349). */
  playerName: string
  /** One reference instant from the table, so every "time ago" agrees. */
  now: Date
  /**
   * Whether the primary input is a mouse (from the cell's one `useHoverCapable`
   * read, shared so every pip agrees). Picks the disclosure primitive *and* the
   * trigger size: a mouse hovers the bare glyph, so the pip stays tight (no
   * padding — the cell's `gap-1` is the only spacing); a finger taps, so the pip
   * grows a `p-1` target (the cell's `-my-1` cancels the height it adds).
   */
  hoverCapable: boolean
  /** The crown/skull pip that acts as the hover/tap trigger. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  const label = matchupAriaLabel(matchup, t)

  if (hoverCapable) {
    return (
      <HoverCard openDelay={140} closeDelay={90}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={label}
            // `cursor-default` (not pointer): it's an informational disclosure,
            // not a link. No padding — the hover target is the glyph itself, so
            // the pips sit as close as the original W/L row did. `group` makes
            // this never-transformed button the hover *detector* for the pip's
            // scale/glow (applied via `group-hover:` on the glyph in
            // `RecentMatchupsCell`): letting the glyph scale off its own `:hover`
            // perturbs its hit-region and makes the hover flicker.
            className="group inline-flex cursor-default rounded-sm"
          >
            {children}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="tooltip-surface w-auto">
          <MatchupCard matchup={matchup} playerName={playerName} now={now} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // `p-1` grows the tap target past the 14px glyph for touch; the cell's
          // `-my-1` cancels the vertical growth so the row height is unchanged.
          // `group` makes this the open-state detector for the pip's scale/glow
          // (`group-data-[state=open]:` on the glyph) — on touch there's no
          // hover, so the open popover is what lights the tapped pip up (#348).
          className="group inline-flex rounded-sm p-1"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="tooltip-surface w-auto">
        <MatchupCard matchup={matchup} playerName={playerName} now={now} />
      </PopoverContent>
    </Popover>
  )
}
