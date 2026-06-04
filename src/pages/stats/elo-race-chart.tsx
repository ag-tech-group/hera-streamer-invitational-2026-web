import { BarChart } from "echarts/charts"
import { GridComponent } from "echarts/components"
import * as echarts from "echarts/core"
import type { EChartsCoreOption } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
// ESM build — see rating-progression-chart.tsx for why `esm/core` not
// `lib/core` (CJS interop hands React an object).
import ReactEChartsCore from "echarts-for-react/esm/core"
import { Pause, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { useStableValue } from "@/hooks/use-stable-value"
import { cn } from "@/lib/utils"
import type { EloRace, EloRaceMode } from "@/pages/stats/elo-race"
import {
  useChartColors,
  type ChartColors,
} from "@/pages/stats/use-chart-colors"

// Trimmed echarts registration for the bar race — the same bar/grid/canvas core
// the ranking boards already use, so the race adds no new echarts modules to the
// lazy /stats chunk.
echarts.use([BarChart, GridComponent, CanvasRenderer])

/**
 * Base milliseconds per frame at 1× speed. Doubles as each update's animation
 * duration, so the bars slide continuously rather than easing to a stop. The
 * speed toggle divides this (2× → half), so motion stays continuous at either
 * speed. Tuned so 1× is a natural watch pace and 2× a quick fast-forward.
 */
const BASE_STEP_MS = 400

/** The echarts bar-label formatter param we read (the bar's plotted value). */
interface BarLabelParam {
  value: number
}

/**
 * UTC date + time of a bucket, e.g. "Jun 1, 18:37" — the race's clock. Forcing
 * UTC keeps the label on the day/time the API bucketed it (matching the bump
 * chart), rather than shifting by the viewer's zone.
 */
function formatBucket(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
  return `${date}, ${time}`
}

function buildOption(
  race: EloRace,
  frame: number,
  colors: ChartColors,
  stepMs: number
): EChartsCoreOption {
  return {
    backgroundColor: "transparent",
    // Right gutter leaves room for the value label that rides each bar's end.
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      // Grow the axis with the field so the leader fills the width each frame.
      max: "dataMax",
      axisLabel: { color: colors.axis, hideOverlap: true },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
    yAxis: {
      type: "category",
      // Fixed category order (current-leader-first from the transform); bars are
      // reordered visually by `realtimeSort`, but label[i] stays paired with
      // data[i], so each racer keeps its colour and name as it moves.
      data: race.entities.map((e) => e.label),
      inverse: true,
      axisLabel: { color: colors.label },
      axisLine: { show: false },
      axisTick: { show: false },
      // Animate the category (bar) reordering at the frame cadence.
      animationDuration: 200,
      animationDurationUpdate: stepMs,
    },
    series: [
      {
        type: "bar",
        // Stable single-series id so echarts merges in place across frames and
        // live refetches (and `valueAnimation` tweens the same datum's label)
        // rather than disposing the model — the live-merge contract (#292).
        id: "elo-race",
        // Re-sort the bars by value on every frame — the race's whole motion.
        realtimeSort: true,
        // The bars aren't interactive (no click target, no tooltip), so keep the
        // default arrow cursor instead of echarts' default hover pointer.
        cursor: "default",
        barWidth: race.entities.length <= 6 ? "55%" : "70%",
        data: race.entities.map((e) => ({
          value: e.values[frame] ?? 0,
          itemStyle: {
            color: e.color,
            borderRadius: [0, 4, 4, 0],
            opacity: 0.9,
          },
        })),
        label: {
          show: true,
          position: "right",
          // Count the number up as the bar grows, rather than snapping.
          valueAnimation: true,
          color: colors.label,
          fontSize: 11,
          formatter: (p: BarLabelParam) => String(Math.round(p.value)),
        },
      },
    ],
    // Linear, frame-paced motion: no intro animation, each update slides over a
    // full step so the bars move continuously rather than easing to a stop.
    animationDuration: 0,
    animationDurationUpdate: stepMs,
    animationEasing: "linear",
    animationEasingUpdate: "linear",
  }
}

/** A play / pause / replay control — the icon and label follow the race state. */
function PlayButton({
  state,
  onClick,
}: {
  state: "play" | "pause" | "replay"
  onClick: () => void
}) {
  const { t } = useTranslation()
  const Icon = state === "pause" ? Pause : state === "replay" ? RotateCcw : Play
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(`stats.race.${state}`)}
      className="border-brand/30 text-brand hover:bg-brand/10 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

/** One segment of the teams/players mode toggle. */
function ModePill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/40 bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:bg-muted/60"
      )}
    >
      {children}
    </button>
  )
}

/**
 * Animated elo bar-chart race (#301) — a broadcast-friendly replay of the
 * standings shuffling over the tournament. Teams race their combined peak elo
 * (the scoring metric) by default; a toggle switches to a per-player peak-rating
 * race. Both derive from `/standings/history` (teams[] / players[]) — the same
 * shared bucket axis the bump chart uses — so there's no client-side bucketing.
 *
 * The timeline is React-driven: `frame` indexes the shared buckets, an interval
 * advances it while playing, and echarts animates each frame's reorder via
 * `realtimeSort`. It **auto-plays once scrolled into view** (not on mount, so it
 * isn't spent before it's seen) at a toggleable **1×/2×** speed, and **pauses
 * while offscreen or the tab is hidden** so it never animates where no one's
 * watching. Built on the same tree-shaken echarts core as the boards and held to
 * the live-merge contract (stable series id + merge, data via `useStableValue`).
 */
export function EloRaceChart({
  teamRace,
  playerRace,
}: {
  teamRace: EloRace
  playerRace: EloRace
}) {
  const { t } = useTranslation()
  const colors = useChartColors()
  const [mode, setMode] = useState<EloRaceMode>("teams")
  // Hold each race steady across value-identical SSE refetches so a no-op nudge
  // doesn't rebuild the chart mid-animation (see useStableValue).
  const stableTeam = useStableValue(teamRace)
  const stablePlayer = useStableValue(playerRace)
  const race = mode === "teams" ? stableTeam : stablePlayer

  // teams[] and players[] share one bucket axis, so the frame index stays valid
  // across a mode switch. Clamp defensively in case a refetch shortened it.
  const frameCount = race.buckets.length
  const lastFrame = Math.max(0, frameCount - 1)
  const [frame, setFrame] = useState(0)
  const clampedFrame = Math.min(frame, lastFrame)
  const atEnd = clampedFrame >= lastFrame
  const [playing, setPlaying] = useState(true)
  // 1× or 2× — divides the base step, so 2× halves both the interval and the
  // per-frame animation, keeping motion continuous.
  const [speed, setSpeed] = useState(1)
  const stepMs = BASE_STEP_MS / speed

  // Gate autoplay on entering the viewport. The race sits well down the page, so
  // starting on mount would run it out before it's seen — instead it begins (and
  // resumes) only while the section is on screen. `inView` also feeds the
  // timeline gate below, so scrolling away pauses the race rather than wasting it.
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Drive the timeline. The interval ticks only while `playing`, the section is
  // in view, AND the tab is visible — scrolling away or hiding the tab clears it
  // (so an offscreen race doesn't burn frames) and returning restarts it, with
  // play intent and the current frame intact. Reaching the end stops playback
  // (the button flips to Replay).
  useEffect(() => {
    if (!playing || frameCount <= 1) return
    let id: ReturnType<typeof setInterval> | undefined
    const canRun = () => inView && document.visibilityState === "visible"
    const start = () => {
      if (id === undefined && canRun()) {
        id = setInterval(() => {
          setFrame((f) => {
            if (f >= frameCount - 1) {
              setPlaying(false)
              return f
            }
            return f + 1
          })
        }, stepMs)
      }
    }
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id)
        id = undefined
      }
    }
    const sync = () => (canRun() ? start() : stop())
    document.addEventListener("visibilitychange", sync)
    start()
    return () => {
      document.removeEventListener("visibilitychange", sync)
      stop()
    }
  }, [playing, frameCount, inView, stepMs])

  const togglePlay = () => {
    if (atEnd) {
      // Replay from the start.
      setFrame(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }

  const onSeek = (e: ChangeEvent<HTMLInputElement>) => {
    // Scrubbing is a manual takeover — pause so the timer doesn't fight the drag.
    setPlaying(false)
    setFrame(Number(e.target.value))
  }

  const switchMode = (next: EloRaceMode) => setMode(next)

  const option = useMemo(
    () => buildOption(race, clampedFrame, colors, stepMs),
    [race, clampedFrame, colors, stepMs]
  )

  // Teams is a tidy four-bar board; the player field is ~20 bars, so give it
  // room (height grows with the roster, floored so a thin field still reads).
  const height =
    mode === "teams" ? 240 : Math.max(360, race.entities.length * 26)

  return (
    <div ref={containerRef}>
      {/* Mode toggle — teams (default) vs players. */}
      <div className="mb-3 flex gap-1.5">
        <ModePill active={mode === "teams"} onClick={() => switchMode("teams")}>
          {t("stats.race.teams")}
        </ModePill>
        <ModePill
          active={mode === "players"}
          onClick={() => switchMode("players")}
        >
          {t("stats.race.players")}
        </ModePill>
      </div>

      <ReactEChartsCore
        echarts={echarts}
        option={option}
        // Merge updates (no notMerge): the single bar series is matched by `id`
        // and updated in place each frame, which is also what lets realtimeSort
        // and valueAnimation tween rather than snap. See the live-merge note.
        lazyUpdate
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />

      {/* Transport: play/pause/replay, a 1×/2× speed toggle, a scrubber over the
          buckets, and the current frame's UTC timestamp. */}
      <div className="mt-3 flex items-center gap-3">
        <PlayButton
          state={atEnd ? "replay" : playing ? "pause" : "play"}
          onClick={togglePlay}
        />
        <button
          type="button"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          aria-pressed={speed === 2}
          aria-label={t("stats.race.speed")}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
            speed === 2
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-border text-muted-foreground hover:bg-muted/60"
          )}
        >
          {speed}×
        </button>
        <input
          type="range"
          min={0}
          max={lastFrame}
          value={clampedFrame}
          onChange={onSeek}
          aria-label={t("stats.race.seek")}
          className="accent-brand grow cursor-pointer"
        />
        <span className="text-muted-foreground font-display w-28 shrink-0 text-right text-xs tabular-nums">
          {race.buckets[clampedFrame]
            ? formatBucket(race.buckets[clampedFrame])
            : ""}
        </span>
      </div>
    </div>
  )
}
