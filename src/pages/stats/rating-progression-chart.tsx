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
import { useTranslation } from "react-i18next"

import type { PlayerSeries } from "@/types"

// Register only the pieces the rating chart uses, so the lazy /stats chunk
// carries a trimmed echarts (line chart + grid/tooltip/legend/zoom on the
// canvas renderer) rather than the full ~1 MB bundle.
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

function buildOption(
  series: PlayerSeries[],
  ratingAxisLabel: string
): EChartsCoreOption {
  return {
    color: LINE_PALETTE,
    backgroundColor: "transparent",
    grid: { left: 8, right: 18, top: 16, bottom: 72, containLabel: true },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: "#cbd5e1" },
      inactiveColor: "#475569",
      pageTextStyle: { color: AXIS },
      pageIconColor: AXIS,
      pageIconInactiveColor: "#475569",
    },
    tooltip: {
      trigger: "axis",
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
      type: "value",
      name: ratingAxisLabel,
      nameTextStyle: { color: AXIS },
      scale: true,
      axisLabel: { color: AXIS },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    // A slider zoom along the bottom so a long tournament's timeline stays
    // legible — drag to focus a window without losing the full-range overview.
    dataZoom: [
      { type: "inside" },
      {
        type: "slider",
        bottom: 40,
        height: 16,
        borderColor: "transparent",
        backgroundColor: "rgba(148,163,184,0.08)",
        fillerColor: "rgba(96,165,250,0.15)",
        textStyle: { color: AXIS },
      },
    ],
    series: series.map((s) => ({
      type: "line",
      name: s.alias,
      showSymbol: false,
      symbolSize: 6,
      lineStyle: { width: 2 },
      emphasis: { focus: "series" },
      // Each point is a [timestamp, rating] pair — the time xAxis plots the
      // rating against the completed-match date.
      data: s.points.map((p) => [p.completedAt, p.rating]),
    })),
  }
}

/**
 * Multi-line chart of every player's rating over the tournament timeline
 * (#164), one line per player. Hovering a line focuses it and dims the rest;
 * the legend scrolls and toggles individual players. Built on a tree-shaken
 * echarts core (see registrations above) and rendered via the
 * `echarts-for-react` core wrapper so no full-echarts import sneaks in.
 */
export function RatingProgressionChart({ series }: { series: PlayerSeries[] }) {
  const { t } = useTranslation()
  const option = useMemo(
    () => buildOption(series, t("stats.ratingAxis")),
    [series, t]
  )
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ height: 480, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
