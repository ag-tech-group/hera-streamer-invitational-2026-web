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

import type { PlayerSeries } from "@/types"

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
 * Vivid-on-dark line palette, cycled across players. Distinguishability beats
 * brand-matching here — with a full roster the eye needs to separate adjacent
 * lines. The chart is styled for the app's default dark theme; light-theme
 * token-matching is a follow-up (noted on the PR).
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

const AXIS = "#94a3b8"
const GRID_LINE = "rgba(148,163,184,0.12)"

function buildOption(series: PlayerSeries[]): EChartsCoreOption {
  return {
    color: LINE_PALETTE,
    backgroundColor: "transparent",
    grid: { left: 8, right: 18, top: 28, bottom: 78, containLabel: true },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: "#cbd5e1" },
      inactiveColor: "#475569",
      pageTextStyle: { color: AXIS },
      pageIconColor: AXIS,
      pageIconInactiveColor: "#475569",
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
        textStyle: { color: AXIS },
      },
    ],
    tooltip: {
      trigger: "axis",
      // Rank the hovered instant's players high-to-low — turns the tooltip
      // into a live leaderboard for that moment.
      order: "valueDesc",
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    xAxis: {
      type: "time",
      axisLabel: { color: AXIS, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
      splitLine: { show: false },
    },
    yAxis: {
      // No axis name — the card's "Rating over time" title already says it,
      // and a top-anchored name clips against the grid edge.
      type: "value",
      scale: true,
      axisLabel: { color: AXIS },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: series.map((s) => ({
      type: "line",
      name: s.alias,
      // Filled-circle symbol so the legend marker reads as a solid coloured
      // dot — the default `emptyCircle` shows a hollow white centre.
      // `showSymbol` stays false, so the line itself carries no point markers.
      symbol: "circle",
      showSymbol: false,
      // Gentle smoothing reads as a trend rather than jagged match-to-match
      // noise; a soft drop shadow lifts the lines off the dark card.
      smooth: 0.2,
      lineStyle: {
        width: 2.5,
        shadowBlur: 8,
        shadowColor: "rgba(2,6,23,0.55)",
        shadowOffsetY: 2,
      },
      // Hovering a line (or its legend entry) thickens it and fades the rest,
      // so a single player's arc is easy to follow through the tangle.
      emphasis: { focus: "series", lineStyle: { width: 3.5 } },
      blur: { lineStyle: { opacity: 0.12 } },
      // Each point is a [timestamp, rating] pair — the time xAxis plots the
      // rating against the completed-match date.
      data: s.points.map((p) => [p.completedAt, p.rating]),
    })),
  }
}

/**
 * Multi-line chart of every player's rating over the tournament timeline
 * (#164), one line per player. Hovering a line focuses it and dims the rest;
 * the legend scrolls and toggles individual players, and the tooltip ranks
 * that instant's players high-to-low. Built on a tree-shaken echarts core
 * (see registrations above) and rendered via the `echarts-for-react` core
 * wrapper so no full-echarts import sneaks in.
 */
export function RatingProgressionChart({ series }: { series: PlayerSeries[] }) {
  const option = useMemo(() => buildOption(series), [series])
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ height: 460, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
