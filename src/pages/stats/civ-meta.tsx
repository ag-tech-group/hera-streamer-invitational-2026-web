import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { CivStat, CivStats } from "@/pages/stats/civ-stats"

/** Most-played civs shown in the pick-rate column. */
const TOP_PICKS = 16

/**
 * Civilization meta (#302): two emblem-led bar lists from the tournament's
 * matches — pick rate (most-played) and win rate (highest win %, gated by a
 * minimum-pick threshold so a 1–0 civ can't top it). Plain HTML/CSS rather than
 * echarts so each civ's colored heraldic shield renders as a native `<img>`.
 */
export function CivMeta({ stats }: { stats: CivStats }) {
  const { t } = useTranslation()
  const topPicks = stats.byPicks.slice(0, TOP_PICKS)
  const maxPicks = topPicks[0]?.picks ?? 1
  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      <CivColumn
        title={t("stats.civ.pickRate")}
        caption={t("stats.civ.matchSample", { count: stats.matchCount })}
        rows={topPicks}
        barPct={(c) => (c.picks / maxPicks) * 100}
        value={(c) => c.picks}
      />
      <CivColumn
        title={t("stats.civ.winRate")}
        caption={t("stats.civ.minGames", { count: stats.minPicks })}
        rows={stats.byWinPct}
        barPct={(c) => c.winPct ?? 0}
        value={(c) => (
          <>
            {(c.winPct ?? 0).toFixed(0)}%{" "}
            <span className="text-muted-foreground/70 text-xs">{c.picks}</span>
          </>
        )}
        emptyHint={t("stats.civ.notEnough")}
      />
    </div>
  )
}

function CivColumn({
  title,
  caption,
  rows,
  barPct,
  value,
  emptyHint,
}: {
  title: string
  caption: string
  rows: CivStat[]
  barPct: (c: CivStat) => number
  value: (c: CivStat) => ReactNode
  emptyHint?: string
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        <span className="text-muted-foreground text-xs">{caption}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {emptyHint}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.civId} className="flex items-center gap-2.5">
              {/* Decorative — the civ name sits right beside it. A civ with no
                  shield (newer than the install snapshot) keeps the slot so the
                  rows stay aligned. */}
              {c.emblemUrl ? (
                <img
                  src={c.emblemUrl}
                  alt=""
                  loading="lazy"
                  className="size-6 shrink-0"
                />
              ) : (
                <span className="size-6 shrink-0" aria-hidden />
              )}
              <span className="w-24 shrink-0 truncate text-sm" title={c.name}>
                {c.name}
              </span>
              <div className="bg-brand/10 relative h-5 flex-1 overflow-hidden rounded">
                <div
                  className="bg-brand absolute inset-y-0 left-0 rounded"
                  style={{ width: `${barPct(c)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                {value(c)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
