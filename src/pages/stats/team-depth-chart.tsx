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
import type { DepthBar } from "@/pages/stats/team-depth"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Same trimmed echarts registration as the ranking bars (bar/grid/tooltip).
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

/** The echarts tooltip-formatter params we read for a hovered segment. */
interface DepthTooltipParam {
  /** Index into the category axis → the team (a row of `sorted`). */
  dataIndex: number
  /** Index of the series → the roster slot (a column of `segments`). */
  seriesIndex: number
  name: string
  value: number
  marker: string
}

function buildOption(bars: DepthBar[], colors: ChartColors): EChartsCoreOption {
  // Ascending by total so the largest team lands at the top of the
  // (bottom-origin) category axis — the same ranking as the combined-sum board.
  const sorted = [...bars].sort((a, b) => a.total - b.total)
  const maxSegments = sorted.reduce((m, b) => Math.max(m, b.segments.length), 0)

  // One bar series per roster "slot": series `s` holds each team's s-th segment,
  // all stacked under one `stack` group → a single bar per team. A team with a
  // shorter roster feeds `null` for the higher slots (nothing drawn). Slot count
  // only ever grows (a peak, once recorded, never clears), so merging by the
  // stable per-slot id never strands a stale series — same guarantee the line
  // and ranking charts rely on.
  const series = Array.from({ length: maxSegments }, (_, s) => ({
    type: "bar" as const,
    stack: "depth",
    id: `depth-${s}`,
    barWidth: "62%",
    // Hover isolates the segment: focus brightens it and blurs the rest (every
    // other member, this team's and others'), so a viewer can read one carry's
    // share cleanly.
    emphasis: { focus: "self" as const },
    blur: { itemStyle: { opacity: 0.4 } },
    data: sorted.map((bar) => {
      const seg = bar.segments[s]
      if (!seg) return null
      const isLast = s === bar.segments.length - 1
      return {
        value: seg.value,
        itemStyle: {
          color: seg.color,
          // Round only the outer end of the final segment; inner joins stay flat
          // so the stack reads as one continuous bar.
          borderRadius: isLast ? [0, 4, 4, 0] : 0,
        },
        // The whole-team total rides the last segment, positioned right of its
        // far edge — which sits at the cumulative stack end, i.e. the total.
        label: isLast
          ? {
              show: true,
              position: "right" as const,
              color: colors.label,
              fontSize: 11,
              formatter: () => String(bar.total),
            }
          : { show: false },
      }
    }),
  }))

  return {
    backgroundColor: "transparent",
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      // Per-item (not axis): hovering a segment fires its own emphasis/blur and
      // names that one member, rather than banding the whole team row.
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      // Member name over their peak. The label isn't stashed on the data item —
      // we read it back from `sorted` by the hovered (team, slot) indices, so
      // each data point stays a plain echarts value.
      formatter: (params: DepthTooltipParam | DepthTooltipParam[]) => {
        const p = Array.isArray(params) ? params[0] : params
        const label = sorted[p.dataIndex]?.segments[p.seriesIndex]?.label
        return `${p.marker}${label ?? p.name}<br/><span style="font-weight:600">${p.value}</span>`
      },
    },
    xAxis: {
      // No `scale` — a stacked bar must originate at 0 so each segment's width
      // reads as its true share of the total.
      type: "value",
      axisLabel: { color: colors.axis, hideOverlap: true },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    yAxis: {
      type: "category",
      data: sorted.map((b) => b.label),
      axisLabel: { color: colors.label },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series,
  }
}

/**
 * Team roster-depth chart (#300) — one horizontal **stacked** bar per team,
 * each segment a member's peak-rating contribution shaded within the team hue,
 * sorted largest-at-top to match the combined-sum board. Where that board ranks
 * teams by a flat total, this one shows the *shape* of the total: one carry vs.
 * balanced depth.
 *
 * Built on the same tree-shaken echarts core as the ranking bars and held to
 * the same live-merge contract (stable per-slot series ids + `merge`, data fed
 * through `useStableValue`) so a refetch mid-hover updates in place instead of
 * racing a destructive rebuild.
 */
export function TeamDepthChart({
  bars,
  height = 320,
}: {
  bars: DepthBar[]
  height?: number
}) {
  const colors = useChartColors()
  const stableBars = useStableValue(bars)
  const option = useMemo(
    () => buildOption(stableBars, colors),
    [stableBars, colors]
  )
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      lazyUpdate
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  )
}
