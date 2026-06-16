import { ChevronDown, ExternalLink, Swords, Trophy } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Collapsible } from "radix-ui"

import { SortableTh } from "@/components/sortable-th"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useHeadToHead } from "@/hooks/use-head-to-head"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  useTableSort,
  type SortableValue,
  type SortState,
} from "@/hooks/use-table-sort"
import { useAnalytics } from "@/lib/analytics"
import { formatDuration, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  topHeadToHeadWinners,
  type HeadToHeadLeader,
} from "@/pages/stats/head-to-head-summary"
import type { HeadToHeadEntrant, HeadToHeadGame } from "@/types"

/** The head-to-head feed arrives newest-first, so When-descending is the
 *  natural default sort — its header shows active on first render. */
const INITIAL_SORT: SortState = { key: "when", direction: "desc" }

/** Sticky, compact header chrome shared by every head-to-head column. */
const HEADER_CLASS = "bg-card sticky top-0 z-10 px-2 py-2"

/**
 * Below this width the six-column table is cramped, so the feed switches to a
 * stack of slim, tap-to-expand rows (mirroring the standings mobile pass). The
 * table's own min-width is ~460px, so this Tailwind `sm` boundary keeps the
 * table on tablets and up where it still fits, and the list on phones.
 */
const MOBILE_QUERY = "(max-width: 639px)"

/** Projects a head-to-head game onto the value each sortable column ranks by. */
function headToHeadSortValue(game: HeadToHeadGame, key: string): SortableValue {
  switch (key) {
    // Entrants are winner-first, so [0] is the winner and [1] the loser.
    case "winner":
      return game.entrants[0]?.name ?? null
    case "loser":
      return game.entrants[1]?.name ?? null
    case "map":
      return game.mapName || null
    case "length":
      return game.durationSeconds
    // ISO timestamps compare lexicographically == chronologically.
    case "when":
      return game.startedAt
    default:
      return null
  }
}

/**
 * The head-to-head feed (#349): a compact table of the tournament's completed
 * streamer-vs-streamer games, newest first — winner, loser (each with civ +
 * elo-at-the-time), map, length, and when, plus a link out to aoe2insights.
 *
 * Self-contained: it owns its `/head-to-head` query and its loading / empty /
 * error states, mirroring the sibling `ChartSection` chrome (brand top stripe
 * over the card surface, uppercase title) so it reads as one of the stats stack.
 * The endpoint returns only streamer-vs-streamer games, so there's no
 * client-side filtering; the feed stays empty (with a friendly placeholder)
 * until the first clash, which is the normal early-tournament state.
 */
export function HeadToHeadCard({ id }: { id?: string }) {
  const { t } = useTranslation()
  const headToHead = useHeadToHead()
  const games = headToHead.data?.games ?? []
  // Who has won the most head-to-heads in the loaded feed (#349) — empty until
  // the first decided game, and more than one when the lead is tied. Drives the
  // summary card above the table.
  const leaders = topHeadToHeadWinners(games)
  // Sortable table over the feed; defaults to When-descending (its newest-first
  // payload order) so the default view matches the data and the header reads as
  // active.
  const {
    sortedRows: sortedGames,
    sortState,
    sortBy,
  } = useTableSort(games, headToHeadSortValue, INITIAL_SORT)
  // Phones get the slim expandable list; tablets and up keep the table. Sorting
  // is desktop-only, so the list just shows the default newest-first order.
  const isMobile = useMediaQuery(MOBILE_QUERY)
  // One reference instant for the whole render so every "when" agrees.
  const now = new Date()

  return (
    <section
      id={id}
      className="bg-card shadow-card relative scroll-mt-20 overflow-hidden rounded-lg p-4 pt-5"
    >
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <h2 className="text-muted-foreground font-display mb-3 flex items-center gap-2 px-1 text-sm tracking-widest uppercase">
        <Swords className="size-4" aria-hidden />
        {t("stats.headToHead.title")}
      </h2>
      {headToHead.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))}
        </div>
      ) : headToHead.isError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-destructive text-sm">{t("stats.error")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => headToHead.refetch()}
          >
            {t("stats.retry")}
          </Button>
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Swords className="text-muted-foreground/50 size-8" aria-hidden />
          <p className="text-foreground text-sm font-medium">
            {t("stats.headToHead.empty")}
          </p>
          <p className="text-muted-foreground max-w-xs text-xs">
            {t("stats.headToHead.emptyHint")}
          </p>
        </div>
      ) : (
        <>
          {leaders.length > 0 ? (
            <HeadToHeadLeaderCard leaders={leaders} />
          ) : null}
          {isMobile ? (
            <HeadToHeadMobileList games={sortedGames} now={now} />
          ) : (
            // Cap the height so a long feed doesn't dominate the stats stack;
            // scroll horizontally instead of crushing columns on a narrow
            // viewport (the standings table uses the same overflow approach).
            <div className="max-h-[26rem] overflow-auto">
              <table className="w-full min-w-[460px] border-collapse text-sm">
                <caption className="sr-only">
                  {t("stats.headToHead.caption")}
                </caption>
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    <SortableTh
                      label={t("stats.headToHead.winner")}
                      sortKey="winner"
                      defaultDirection="asc"
                      sortState={sortState}
                      onSort={sortBy}
                      className={HEADER_CLASS}
                    />
                    <SortableTh
                      label={t("stats.headToHead.loser")}
                      sortKey="loser"
                      defaultDirection="asc"
                      sortState={sortState}
                      onSort={sortBy}
                      className={HEADER_CLASS}
                    />
                    <SortableTh
                      label={t("stats.headToHead.map")}
                      sortKey="map"
                      defaultDirection="asc"
                      sortState={sortState}
                      onSort={sortBy}
                      className={HEADER_CLASS}
                    />
                    <SortableTh
                      label={t("stats.headToHead.length")}
                      align="right"
                      sortKey="length"
                      defaultDirection="desc"
                      sortState={sortState}
                      onSort={sortBy}
                      className={HEADER_CLASS}
                    />
                    <SortableTh
                      label={t("stats.headToHead.when")}
                      align="right"
                      sortKey="when"
                      defaultDirection="desc"
                      sortState={sortState}
                      onSort={sortBy}
                      className={HEADER_CLASS}
                    />
                    {/* The link column isn't sortable — a plain header. */}
                    <SortableTh
                      label={t("stats.headToHead.link")}
                      align="right"
                      className={HEADER_CLASS}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedGames.map((game) => (
                    <HeadToHeadRow key={game.matchId} game={game} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Summary above the table (#349): the player(s) with the most head-to-head
 *  wins in the loaded feed — a trophy + brand-tinted highlight (content-width,
 *  not full-bleed) matching the headline stat cards' icon language. When the
 *  lead is tied, every level player is named, comma-separated. The name(s) carry
 *  the animated brand sheen, the feature's one flourish; all tied players share
 *  the same win count, shown once. */
function HeadToHeadLeaderCard({ leaders }: { leaders: HeadToHeadLeader[] }) {
  const { t, i18n } = useTranslation()
  // All tied leaders are level on wins, so any leader's count speaks for them.
  const names = formatLeaderNames(
    leaders.map((leader) => leader.name),
    i18n.language
  )
  return (
    <div className="bg-brand/5 mb-3 flex w-fit max-w-full items-center gap-3 rounded-md px-3 py-2.5">
      <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Trophy className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
          {t("stats.headToHead.topWinner")}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="head-to-head-winner font-display truncate text-base tracking-wide">
            {names}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {t("stats.headToHead.winCount", { count: leaders[0].wins })}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * Joins the tied leaders' names into one locale-aware, comma-separated list —
 * "A, B, C" in English, with each locale's own separators (#349; `type: "unit"`
 * keeps the commas but drops the "and"/"or" conjunction). Falls back to
 * comma-joining if the runtime lacks `Intl.ListFormat`.
 */
function formatLeaderNames(names: string[], lang: string): string {
  try {
    return new Intl.ListFormat(lang, {
      style: "long",
      type: "unit",
    }).format(names)
  } catch {
    return names.join(", ")
  }
}

/** One desktop game row: winner, loser, map, length, when, and the match link. */
function HeadToHeadRow({ game, now }: { game: HeadToHeadGame; now: Date }) {
  const { i18n } = useTranslation()
  // Entrants arrive winner-first from the API (preserved by the adapter).
  const [winner, loser] = game.entrants
  return (
    <tr className="border-border border-t">
      <td className="px-2 py-2">
        <EntrantCell entrant={winner} won />
      </td>
      <td className="px-2 py-2">
        <EntrantCell entrant={loser} />
      </td>
      <td className="text-muted-foreground px-2 py-2 whitespace-nowrap">
        {game.mapName || "—"}
      </td>
      <td className="text-muted-foreground px-2 py-2 text-end tabular-nums">
        {game.durationSeconds !== null
          ? formatDuration(game.durationSeconds)
          : "—"}
      </td>
      <td
        className="text-muted-foreground px-2 py-2 text-end whitespace-nowrap tabular-nums"
        // Relative time scans at a glance; the absolute date rides the hover.
        title={formatGameDate(game.startedAt, i18n.language)}
      >
        {formatRelativeTime(game.startedAt, now)}
      </td>
      <td className="py-2 ps-1 text-end">
        <MatchLink matchId={game.matchId} matchUrl={game.matchUrl} />
      </td>
    </tr>
  )
}

/** The external aoe2insights link for a game, with its click analytics (#349).
 *  Shared by the desktop row and the mobile expanded panel. */
function MatchLink({
  matchId,
  matchUrl,
}: {
  matchId: number
  matchUrl: string
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  return (
    <a
      href={matchUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("stats.headToHead.matchLink")}
      title={t("stats.headToHead.matchLink")}
      onClick={() =>
        analytics.track("headtohead.match.click", {
          matchId,
          source: "stats",
        })
      }
      className="text-muted-foreground hover:text-brand inline-flex p-1 transition-colors"
    >
      <ExternalLink className="size-4" aria-hidden />
    </a>
  )
}

/**
 * The mobile head-to-head feed (#349): a stack of slim, tap-to-expand rows, the
 * same pass the standings table got. The collapsed row shows the matchup —
 * winner vs loser (civ emblem + name + elo) — and expanding reveals the rest
 * (map, length, when, link). Sorting is desktop-only, so the list keeps the
 * default newest-first order.
 */
export function HeadToHeadMobileList({
  games,
  now,
}: {
  games: HeadToHeadGame[]
  now: Date
}) {
  return (
    <ul role="list" className="divide-border border-border divide-y border-t">
      {games.map((game) => (
        <HeadToHeadMobileRow key={game.matchId} game={game} now={now} />
      ))}
    </ul>
  )
}

/** One expandable mobile game: matchup collapsed, the other stats on expand. */
function HeadToHeadMobileRow({
  game,
  now,
}: {
  game: HeadToHeadGame
  now: Date
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [winner, loser] = game.entrants
  return (
    <li>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="hover:bg-brand/6 active:bg-brand/10 focus-visible:ring-brand flex min-h-11 w-full items-center gap-2 px-1 py-2.5 text-start text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            {/* The matchup: winner vs loser, each civ emblem + name + elo. */}
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <EntrantCell entrant={winner} won />
              <span className="text-muted-foreground shrink-0 text-xs">
                {t("standings.recentMatchup.vs")}
              </span>
              <EntrantCell entrant={loser} />
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          </button>
        </Collapsible.Trigger>
        {/* Reuses the standings' generic collapsible height tween. */}
        <Collapsible.Content className="standings-collapsible-content overflow-hidden">
          <dl className="border-border grid grid-cols-2 gap-x-4 gap-y-3 border-t px-1 pt-3 pb-3">
            <MobileDetail label={t("stats.headToHead.map")}>
              {game.mapName || "—"}
            </MobileDetail>
            <MobileDetail label={t("stats.headToHead.length")}>
              {game.durationSeconds !== null
                ? formatDuration(game.durationSeconds)
                : "—"}
            </MobileDetail>
            <MobileDetail label={t("stats.headToHead.when")}>
              <span title={formatGameDate(game.startedAt, i18n.language)}>
                {formatRelativeTime(game.startedAt, now)}
              </span>
            </MobileDetail>
            <MobileDetail label={t("stats.headToHead.link")}>
              <MatchLink matchId={game.matchId} matchUrl={game.matchUrl} />
            </MobileDetail>
          </dl>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  )
}

/** A label/value pair in the mobile expanded panel. */
function MobileDetail({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** A player within a row: civ emblem, name, and the elo they took into the game.
 *  The winner's name is bold; the loser reads as plain regular text. The animated
 *  sheen lives on the summary card's leader, not here. */
function EntrantCell({
  entrant,
  won = false,
}: {
  entrant: HeadToHeadEntrant
  won?: boolean
}) {
  return (
    // `min-w-0` lets the name truncate in the constrained mobile matchup row; in
    // the wider desktop cell there's room, so it never actually clips there.
    <span className="flex min-w-0 items-center gap-1.5">
      {entrant.civEmblemUrl ? (
        <img
          src={entrant.civEmblemUrl}
          alt={entrant.civName ?? ""}
          title={entrant.civName ?? undefined}
          loading="lazy"
          className="size-4 shrink-0"
        />
      ) : (
        // Held slot keeps names aligned when we have no shield for the civ.
        <span className="size-4 shrink-0" aria-hidden />
      )}
      {/* Winner's name is bold; loser is plain regular text (#349). */}
      <span className={cn("truncate", won && "font-semibold")}>
        {entrant.name}
      </span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {entrant.oldRating ?? "—"}
      </span>
    </span>
  )
}

/**
 * Short, locale-aware absolute game date for the "when" cell's hover title —
 * e.g. `Jun 3` — complementing the relative time shown in the cell. Falls back
 * to the raw ISO string if the runtime can't format it.
 */
function formatGameDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
