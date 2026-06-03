import { LineChart } from "echarts/charts"
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// The ESM build — the CJS `lib/core` default-exports through an interop
// wrapper that Vite hands back as `{ default }` (an object), which React
// rejects as an element type. `esm/core` is a clean ESM default export.
import ReactEChartsCore from "echarts-for-react/esm/core"
import { useMemo } from "react"

import { useStableValue } from "@/hooks/use-stable-value"
import {
  toForwardFilledSeries,
  type ChartSeries,
} from "@/pages/stats/progression-series"
import type { LabeledSeries } from "@/pages/stats/series-labels"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Register only the pieces the rating chart uses, so the lazy /stats chunk
// carries a trimmed echarts (line chart + grid/tooltip/legend on the canvas
// renderer) rather than the full ~1 MB bundle.
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

/**
 * Vivid line palette, cycled across players. Distinguishability beats
 * brand-matching here — with a full roster the eye needs to separate adjacent
 * lines. The saturated hues read on both themes; the axis / legend text
 * colours adapt to the active theme via `useChartColors` (#207).
 */
const LINE_PALETTE = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#a3e635",
  "#facc15",
  "#f97316",
]

/** The subset of an echarts axis-tooltip param the formatter reads. */
interface LineTooltipParam {
  /** Axis value at the pointer — milliseconds, since the x-axis is `time`. */
  axisValue: number
  /** The data item: `[timestampMs, rating | null]`. */
  value: [number, number | null]
  /** Resolved series colour (from the palette). */
  color: string
  /** Series display label. */
  seriesName: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Absolute date + time header, e.g. "May 29, 2026, 5:36 AM". */
function formatTooltipDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Axis tooltip: a date header over every player's held rating at the hovered
 * instant, ranked high-to-low — a live leaderboard for that moment (#280). Each
 * row is tinted with the player's own line colour. Players with no rating yet at
 * that time (before their first match) are dropped. Returns an HTML string that
 * echarts inserts as innerHTML, so the player label is escaped.
 */
function formatTooltip(params: LineTooltipParam | LineTooltipParam[]): string {
  const list = Array.isArray(params) ? params : [params]
  const rows = list
    .filter((p) => p.value?.[1] != null)
    .sort((a, b) => (b.value[1] as number) - (a.value[1] as number))
  if (rows.length === 0) return ""

  const header = `<div style="margin-bottom:6px;font-weight:600;color:#e2e8f0">${formatTooltipDate(
    rows[0].axisValue
  )}</div>`
  const body = rows
    .map((p) => {
      const dot = `<span style="display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:9999px;background:${p.color}"></span>`
      const name = `<span style="color:${p.color}">${dot}${escapeHtml(p.seriesName)}</span>`
      const value = `<span style="margin-left:20px;color:#e2e8f0;font-variant-numeric:tabular-nums">${p.value[1]}</span>`
      return `<div style="display:flex;align-items:center;justify-content:space-between;line-height:1.6">${name}${value}</div>`
    })
    .join("")
  return header + body
}

function buildOption(
  series: ChartSeries[],
  colors: ChartColors
): EChartsCoreOption {
  return {
    color: LINE_PALETTE,
    backgroundColor: "transparent",
    grid: { left: 8, right: 18, top: 28, bottom: 78, containLabel: true },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: colors.label },
      inactiveColor: colors.legendInactive,
      pageTextStyle: { color: colors.axis },
      pageIconColor: colors.axis,
      pageIconInactiveColor: colors.legendInactive,
    },
    // A slider rail along the bottom: drag the edges to focus a window of the
    // timeline; once zoomed in, grab the middle to pan. `inside` adds
    // wheel-zoom over the plot area.
    dataZoom: [
      { type: "inside" },
      {
        type: "slider",
        bottom: 36,
        height: 16,
        borderColor: "transparent",
        backgroundColor: "rgba(148,163,184,0.08)",
        fillerColor: "rgba(96,165,250,0.15)",
        textStyle: { color: colors.axis },
      },
    ],
    tooltip: {
      trigger: "axis",
      // Keep the tooltip within the chart bounds: the `ChartSection` card is
      // `overflow-hidden`, so a tooltip drifting past an edge gets clipped
      // (#314). `confine` flips/clamps it to stay inside instead.
      confine: true,
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      // Snap the crosshair to the shared timeline so it sits on real data for
      // every line at once — the root of #280's "hover doesn't match the
      // cursor / shows the wrong player".
      axisPointer: {
        type: "line",
        snap: true,
        lineStyle: { color: "rgba(148,163,184,0.45)", width: 1 },
      },
      formatter: formatTooltip,
    },
    xAxis: {
      type: "time",
      axisLabel: { color: colors.axis, hideOverlap: true },
      axisLine: { lineStyle: { color: colors.gridLine } },
      splitLine: { show: false },
    },
    yAxis: {
      // No axis name — the card's "Rating over time" title already says it,
      // and a top-anchored name clips against the grid edge.
      type: "value",
      scale: true,
      axisLabel: { color: colors.axis },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    series: series.map((s) => ({
      type: "line",
      // Stable identity so echarts merges each player's series in place across
      // live refetches (matching by id, not array position) instead of
      // disposing and rebuilding it — see the chart component for why. Keyed on
      // the unified tournamentPlayerId (#187).
      id: s.tournamentPlayerId,
      // The host's display-name override (joined upstream in StatsPage), else
      // the raw ladder alias — so the legend/tooltip match the rest of the site.
      name: s.label,
      // Ratings are discrete: they hold between matches, then jump at the one
      // that moved them. Step *after* each point so the line reads that way, and
      // no smoothing — a smoothed step implies gradual drift the rating never had.
      step: "end",
      // Filled-circle symbol so the legend marker reads as a solid coloured dot
      // (the default `emptyCircle` is a hollow white centre). `showSymbol` stays
      // false, so the line itself carries no per-point markers.
      symbol: "circle",
      showSymbol: false,
      lineStyle: {
        width: 2,
        shadowBlur: 6,
        shadowColor: "rgba(2,6,23,0.5)",
        shadowOffsetY: 1,
      },
      // No hover emphasis or dimming on the lines: the axis crosshair already
      // lists every player at that instant, so fading all-but-one would
      // contradict the tooltip. Hover responds through the crosshair only —
      // the tooltip and the line states stay consistent (#280 follow-up).
      emphasis: { disabled: true },
      // Forward-filled `[timestampMs, rating | null]` over the shared timeline
      // (see progression-series) — null before the player's first match.
      data: s.data,
    })),
  }
}

/**
 * Multi-line chart of every player's rating over the tournament timeline
 * (#164), one stepped line per player. Hovering anywhere drops a crosshair and
 * lists every player's held rating at that instant, ranked high-to-low (#280);
 * the legend scrolls and toggles individual players. Lines hold their last
 * value to the right edge when a player stops, rather than ending early. Built
 * on a tree-shaken echarts core (see registrations above) and rendered via the
 * `echarts-for-react` core wrapper so no full-echarts import sneaks in.
 */
export function RatingProgressionChart({
  series,
}: {
  series: LabeledSeries[]
}) {
  const colors = useChartColors()
  // Hold the series reference steady across value-identical SSE refetches so a
  // live nudge that changed nothing doesn't rebuild the chart (see
  // useStableValue). Combined with merge updates below, the chart is only
  // touched when ratings actually move.
  const stableSeries = useStableValue(series)
  // Resample onto the shared timeline: crisp steps, lines that hold their value
  // to the right edge when a player stops, and an axis tooltip that lists every
  // player's exact rating at the hovered instant (see progression-series).
  const chartSeries = useMemo(
    () => toForwardFilledSeries(stableSeries),
    [stableSeries]
  )
  const option = useMemo(
    () => buildOption(chartSeries, colors),
    [chartSeries, colors]
  )
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      // No `notMerge`: echarts merges each series by `id` (set in buildOption),
      // updating its data model in place rather than disposing and rebuilding
      // it. The destructive rebuild was racing echarts' own hover dispatch — a
      // mousemove landing mid-rebuild called getDataParams on a disposed model
      // (`undefined.getRawIndex`) and threw. Series only ever grow (a player
      // joins the chart on their first completed match) and are never removed,
      // so a plain merge never leaves a ghost line — no `replaceMerge` needed.
      lazyUpdate
      style={{ height: 460, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
