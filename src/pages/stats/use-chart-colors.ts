import { useEffect, useState } from "react"

import { useTheme } from "@/components/theme-provider"

/**
 * Canvas text/line colours for the stats echarts charts. echarts paints to a
 * `<canvas>`, which can't inherit the CSS theme tokens — so without this the
 * axis labels stay dark-theme grey and wash out on the light theme (the card
 * title is HTML and adapts; the canvas axis text doesn't — which is also why
 * Lighthouse's contrast audit misses it, #207). These two sets keep the axis
 * labels, series labels, gridlines, and legend readable on both themes.
 */
export interface ChartColors {
  /** Axis tick labels (value / time numbers) + legend pager / zoom text. */
  axis: string
  /** Higher-contrast text: category labels, bar value labels, legend entries. */
  label: string
  /** Subtle split / grid lines. */
  gridLine: string
  /** Dimmed legend entries (toggled-off players). */
  legendInactive: string
}

const DARK: ChartColors = {
  axis: "#94a3b8", // slate-400
  label: "#cbd5e1", // slate-300
  gridLine: "rgba(148,163,184,0.12)",
  legendInactive: "#475569", // slate-600
}

const LIGHT: ChartColors = {
  axis: "#475569", // slate-600 — readable on the light card surface
  label: "#334155", // slate-700
  gridLine: "rgba(71,85,105,0.18)",
  legendInactive: "#94a3b8", // slate-400
}

/**
 * Resolves the active theme (following the OS scheme when set to "system") and
 * returns the matching chart colour set. Reactive: it flips when the viewer
 * switches theme or the OS scheme changes, so the charts recolour live.
 */
export function useChartColors(): ChartColors {
  const { theme } = useTheme()
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  )

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const isDark = theme === "dark" || (theme === "system" && systemDark)
  return isDark ? DARK : LIGHT
}
