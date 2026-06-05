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
 * One side of the matchup: a muted "Player" / "Opponent" caption over the civ
 * chip, so it's unambiguous which shield is whose (the outcome heading already
 * speaks for the player, but the two civs sit side by side). The caption mirrors
 * the small uppercase section labels used across /stats.
 */
function CivSide({
  label,
  name,
  emblemUrl,
}: {
  label: string
  name: string | null
  emblemUrl: string | null
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <CivChip name={name} emblemUrl={emblemUrl} />
    </div>
  )
}

/**
 * The civ-matchup card body (#339): an outcome-coloured heading (Won/Lost) over
 * the player's civ `vs` the opponent's — each a labelled heraldic emblem + name
 * — then a muted "map · time ago" context line. Mirrors the dotted-heading
 * structure of the sibling standings tooltips (`BioCard`, `WinLossBreakdown`,
 * `WatchCard`) so the family reads as one.
 */
function MatchupCard({ matchup, now }: { matchup: RecentMatchup; now: Date }) {
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
      {/* Bottom-aligned so the "vs" sits on the civ row, clear of the captions. */}
      <div className="flex items-end gap-2 text-sm">
        <CivSide
          label={t("standings.recentMatchup.player")}
          name={matchup.civName}
          emblemUrl={matchup.civEmblemUrl}
        />
        <span className="text-muted-foreground shrink-0 pb-0.5 text-xs tracking-wide uppercase">
          {t("standings.recentMatchup.vs")}
        </span>
        <CivSide
          label={t("standings.recentMatchup.opponent")}
          name={matchup.opponentCivName}
          emblemUrl={matchup.opponentCivEmblemUrl}
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
  now,
  hoverCapable,
  children,
}: {
  matchup: RecentMatchup
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
            // the pips sit as close as the original W/L row did.
            className="inline-flex cursor-default rounded-sm"
          >
            {children}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="tooltip-surface w-auto">
          <MatchupCard matchup={matchup} now={now} />
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
          className="inline-flex rounded-sm p-1"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="tooltip-surface w-auto">
        <MatchupCard matchup={matchup} now={now} />
      </PopoverContent>
    </Popover>
  )
}
