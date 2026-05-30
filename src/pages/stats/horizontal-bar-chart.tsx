import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// ESM build — see rating-progression-chart.tsx for why `esm/core` not
// `lib/core` (CJS interop hands React an object).
import ReactEChartsCore from "echarts-for-react/esm/core"
import { useMemo } from "react"

// Trimmed echarts registration for the ranking bars.
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const AXIS = "#94a3b8"
const GRID_LINE = "rgba(148,163,184,0.12)"

/** One bar: a labelled, coloured value (e.g. a team's combined elo). */
export interface BarDatum {
  label: string
  value: number
  color: string
}

function buildOption(data: BarDatum[]): EChartsCoreOption {
  // Ascending so the largest lands at the top of the (bottom-origin) category
  // axis — the chart reads as a top-down ranking.
  const sorted = [...data].sort((a, b) => a.value - b.value)
  return {
    backgroundColor: "transparent",
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    xAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: AXIS },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.label),
      axisLabel: { color: "#cbd5e1" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        barWidth: "62%",
        // Per-bar colour (team palette / brand), rounded on the outer end.
        data: sorted.map((d) => ({
          value: d.value,
          itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: "right",
          color: "#cbd5e1",
          fontSize: 11,
        },
      },
    ],
  }
}

/**
 * A horizontal ranking bar chart (#164) — one coloured bar per entry, sorted
 * largest-at-top, value labelled at the bar end. Reused for the team
 * combined-elo board and the per-player peak-rating board. Built on the same
 * tree-shaken echarts core as the line chart (bar/grid/tooltip only).
 */
export function HorizontalBarChart({
  data,
  height = 320,
}: {
  data: BarDatum[]
  height?: number
}) {
  const option = useMemo(() => buildOption(data), [data])
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
