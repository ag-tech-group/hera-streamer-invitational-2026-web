import { LineChart } from "echarts/charts"
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// ESM build — see rating-progression-chart.tsx for why `esm/core` not
// `lib/core` (CJS interop hands React an object).
import ReactEChartsCore from "echarts-for-react/esm/core"
import { useMemo, useState } from "react"

import { useStableValue } from "@/hooks/use-stable-value"
import {
  ChartLegend,
  type ChartLegendItem,
  type ChartLegendTeam,
  type ChartTeam,
} from "@/pages/stats/chart-legend"
import type { BumpSeries } from "@/pages/stats/bump-series"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Trimmed echarts registration for the bump chart (line + grid/tooltip/legend).
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

/** One series' slice of the axis-trigger tooltip at the hovered bucket. */
interface BumpTooltipParam {
  /** Index of the series → which player. */
  seriesIndex: number
  /** Index along the category axis → which bucket. */
  dataIndex: number
  /** The plotted value — the player's position at that bucket. */
  value: number
  /** Resolved series (team) colour. */
  color: string
  seriesName: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * UTC calendar date of a bucket, e.g. "Jun 1" — the axis day marker. Forcing
 * UTC keeps the label on the day the API bucketed it (a viewer-zone render would
 * shift a `00:00Z` anchor back a day).
 */
function formatBucketDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/** UTC date + time of a bucket, e.g. "Jun 1, 18:37" — the tooltip header. */
function formatBucketTime(iso: string): string {
  const d = new Date(iso)
  const date = formatBucketDate(iso)
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
  return `${date}, ${time}`
}

/** UTC `YYYY-MM-DD` key, to detect when the axis crosses into a new day. */
function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function buildOption(
  buckets: string[],
  series: BumpSeries[],
  colors: ChartColors,
  selected: Record<string, boolean>
): EChartsCoreOption {
  // Deepest position any line reaches — the inverted axis runs 1 (top) to this,
  // so a slider's dive stays on-chart. minInterval keeps ticks integer.
  const maxPosition = series.reduce(
    (m, s) => s.points.reduce((mm, p) => Math.max(mm, p.position), m),
    1
  )
  return {
    backgroundColor: "transparent",
    grid: { left: 8, right: 18, top: 12, bottom: 30, containLabel: true },
    legend: {
      // Rendered in HTML below the canvas (ChartLegend) so it can match the
      // civ-card pills and cap names per row — the canvas legend couldn't
      // (#326). The legend *model* stays (hidden) and takes `selected` so a
      // pill toggle filters the series; the HTML is just the control surface.
      show: false,
      selected,
    },
    tooltip: {
      // Axis trigger: hovering a bucket lists the whole standings at that
      // moment, ranked. A category axis fires across the whole width (a sparse
      // time axis only triggered at the ends).
      trigger: "axis",
      // Keep the (tall, full-roster) tooltip inside the overflow-hidden card.
      confine: true,
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      axisPointer: {
        type: "line",
        snap: true,
        lineStyle: { color: "rgba(148,163,184,0.45)", width: 1 },
      },
      formatter: (params: BumpTooltipParam | BumpTooltipParam[]) => {
        const list = Array.isArray(params) ? params : [params]
        const rows = [...list].sort((a, b) => a.value - b.value)
        if (rows.length === 0) return ""
        // Full timestamp — buckets are per-shift, so two on the same day differ
        // only by time.
        const header = `<div style="margin-bottom:6px;font-weight:600;color:#e2e8f0">${formatBucketTime(
          buckets[rows[0].dataIndex]
        )}</div>`
        const body = rows
          .map((p) => {
            // Position only — this is a standings chart, so the tooltip stays
            // about position (no rating/elo, which reads as a different metric).
            const posTag = `<span style="margin-right:8px;color:#94a3b8;font-variant-numeric:tabular-nums">#${p.value}</span>`
            const dot = `<span style="display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:9999px;background:${p.color}"></span>`
            const name = `<span style="color:${p.color}">${dot}${escapeHtml(p.seriesName)}</span>`
            return `<div style="display:flex;align-items:center;line-height:1.6">${posTag}${name}</div>`
          })
          .join("")
        return header + body
      },
    },
    xAxis: {
      // Category, one slot per bucket (a daily anchor or a position shift),
      // evenly spaced so each shift reads as a step rather than being crushed
      // by time gaps. Label only the first bucket of each day — the rest are
      // intra-day shifts — so the axis carries clean day markers; the exact
      // shift time lives in the tooltip.
      type: "category",
      data: buckets,
      boundaryGap: false,
      axisLabel: {
        color: colors.axis,
        interval: 0,
        hideOverlap: true,
        formatter: (iso: string, index: number) =>
          index === 0 ||
          utcDayKey(buckets[index]) !== utcDayKey(buckets[index - 1])
            ? formatBucketDate(iso)
            : "",
      },
      axisLine: { lineStyle: { color: colors.gridLine } },
      splitLine: { show: false },
    },
    yAxis: {
      // Position axis, 1 at the top. `inverse` flips it so the smaller (better)
      // position sits up high; min:1 pins the leader to the top edge.
      type: "value",
      inverse: true,
      min: 1,
      max: maxPosition,
      minInterval: 1,
      axisLabel: { color: colors.axis, formatter: (v: number) => `#${v}` },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    series: series.map((s) => ({
      type: "line",
      // Stable identity so echarts merges each line in place across live
      // refetches (matching by id, not array position). The entrant set is
      // fixed, so a plain merge never strands a ghost line.
      id: s.tournamentPlayerId,
      name: s.label,
      // The plotted y per bucket is the position. The API ranks every entity at
      // every bucket, so the line is continuous (no gaps to bridge).
      data: s.points.map((p) => p.position),
      symbol: "circle",
      symbolSize: 6,
      showSymbol: true,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color, width: 2.5 },
      // No hover emphasis: the axis crosshair already lists every player at the
      // hovered day, so fading all-but-one would contradict the tooltip.
      emphasis: { disabled: true },
    })),
  }
}

/**
 * Position bump chart (#299) — each line is an entrant's leaderboard position
 * over the tournament, weaving as standings shift; "The Climb". Position is by
 * peak (matching the standings table) and comes straight from the API's
 * `/standings/history`, so a climb reads as a climb and past buckets never
 * shift. Team-coloured, with teammates shaded apart within the team hue.
 *
 * Built on the same tree-shaken echarts core as the rating line chart and held
 * to the live-merge contract (stable series ids + `merge`, data via
 * `useStableValue`) so a refetch mid-hover updates in place.
 */
export function BumpChart({
  buckets,
  series,
  teams = [],
  teamIdByTournamentPlayerId,
}: {
  buckets: string[]
  series: BumpSeries[]
  /** Teams for the bulk-toggle pills (omit to hide them). */
  teams?: ChartTeam[]
  /** tournamentPlayerId → teamId, to group each line under its team. */
  teamIdByTournamentPlayerId?: Map<number, number>
}) {
  const colors = useChartColors()
  const stableBuckets = useStableValue(buckets)
  const stableSeries = useStableValue(series)
  // Legend pills carry each line's explicit team colour (set in toBumpSeries),
  // so the dot matches the line exactly.
  const items = useMemo<ChartLegendItem[]>(
    () => stableSeries.map((s) => ({ name: s.label, color: s.color })),
    [stableSeries]
  )
  // Which lines are shown. A name absent from the map counts as shown, so the
  // empty initial state shows everyone; toggling writes explicit booleans.
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const toggle = (name: string) =>
    setSelected((prev) => ({ ...prev, [name]: prev[name] === false }))
  const showAll = () =>
    setSelected(Object.fromEntries(items.map((it) => [it.name, true])))
  const invert = () =>
    setSelected((prev) =>
      Object.fromEntries(items.map((it) => [it.name, prev[it.name] === false]))
    )
  // Group the chart's lines under their team for the bulk-toggle pills — each
  // pill carries the labels of the team's players that appear in this chart.
  const legendTeams = useMemo<ChartLegendTeam[]>(
    () =>
      teams.flatMap((team) => {
        const memberNames = stableSeries
          .filter(
            (s) =>
              teamIdByTournamentPlayerId?.get(s.tournamentPlayerId) ===
              team.teamId
          )
          .map((s) => s.label)
        return memberNames.length > 0 ? [{ ...team, memberNames }] : []
      }),
    [teams, stableSeries, teamIdByTournamentPlayerId]
  )
  const toggleTeam = (team: ChartLegendTeam) =>
    setSelected((prev) => {
      // Fully shown → hide the whole team; otherwise (any player off) show all.
      const show = !team.memberNames.every((n) => prev[n] !== false)
      const next = { ...prev }
      for (const n of team.memberNames) next[n] = show
      return next
    })
  const option = useMemo(
    () => buildOption(stableBuckets, stableSeries, colors, selected),
    [stableBuckets, stableSeries, colors, selected]
  )
  return (
    <>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        lazyUpdate
        style={{ height: 420, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
      <ChartLegend
        items={items}
        selected={selected}
        onToggle={toggle}
        onAll={showAll}
        onInvert={invert}
        teams={legendTeams}
        onToggleTeam={toggleTeam}
      />
    </>
  )
}
