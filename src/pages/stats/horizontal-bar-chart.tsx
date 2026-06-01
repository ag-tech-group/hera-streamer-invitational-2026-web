import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// ESM build — see rating-progression-chart.tsx for why `esm/core` not
// `lib/core` (CJS interop hands React an object).
import ReactEChartsCore from "echarts-for-react/esm/core"
import { useMemo } from "react"

import { useStableValue } from "@/hooks/use-stable-value"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Trimmed echarts registration for the ranking bars.
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

/** One bar: a labelled, coloured value (e.g. a team's combined elo). */
export interface BarDatum {
  label: string
  value: number
  color: string
}

/** The echarts tooltip-formatter params we read (axis trigger → an array). */
interface BarTooltipParam {
  name: string
  value: number
  marker: string
}

function buildOption(data: BarDatum[], colors: ChartColors): EChartsCoreOption {
  // Ascending so the largest lands at the top of the (bottom-origin) category
  // axis — the chart reads as a top-down ranking.
  const sorted = [...data].sort((a, b) => a.value - b.value)
  return {
    backgroundColor: "transparent",
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      // Per-item: hovering a bar fires its emphasis (and blurs the rest), which
      // an `axis` trigger doesn't drive — it would show the tooltip but leave
      // every bar at full strength. This replaces the default shadow band too.
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      // The hovered bar's label (y/category) over its value (x).
      formatter: (params: BarTooltipParam | BarTooltipParam[]) => {
        const p = Array.isArray(params) ? params[0] : params
        return `${p.marker}${p.name}<br/><span style="font-weight:600">${p.value}</span>`
      },
    },
    xAxis: {
      type: "value",
      scale: true,
      // `hideOverlap` drops value labels that would collide rather than
      // letting them smear together — the tight `scale: true` range packs
      // too many ticks for a narrow (mobile) plot width otherwise.
      axisLabel: { color: colors.axis, hideOverlap: true },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.label),
      axisLabel: { color: colors.label },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        // Stable single-series id so echarts merges this series in place across
        // live refetches instead of rebuilding it — see the chart component.
        id: "ranking",
        barWidth: "62%",
        // Per-bar colour (team palette / brand), rounded on the outer end. Base
        // opacity sits a touch below full so the hovered bar can brighten to
        // full while the rest dim — see `emphasis` / `blur` below.
        data: sorted.map((d) => ({
          value: d.value,
          itemStyle: {
            color: d.color,
            borderRadius: [0, 4, 4, 0],
            opacity: 0.85,
          },
        })),
        // Hover focuses the bar (brightens it to full) and blurs the others
        // (dims them, but only gently) — in place of echarts' default highlight.
        emphasis: { focus: "self", itemStyle: { opacity: 1 } },
        blur: { itemStyle: { opacity: 0.5 } },
        label: {
          show: true,
          position: "right",
          color: colors.label,
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
  const colors = useChartColors()
  // Steady reference across value-identical refetches so a live nudge that
  // changed nothing doesn't rebuild the chart (see useStableValue).
  const stableData = useStableValue(data)
  const option = useMemo(
    () => buildOption(stableData, colors),
    [stableData, colors]
  )
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      // No `notMerge`: echarts merges the series by `id` (set in buildOption)
      // and updates its data in place rather than disposing the model. The old
      // destructive rebuild raced echarts' hover dispatch — a mousemove landing
      // mid-rebuild read getRawIndex off a disposed model and threw. Bars only
      // ever grow in count (a player appears once they have a rating), so a
      // plain merge never strands a stale bar.
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
