import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Countdown } from "@/components/countdown"

describe("Countdown", () => {
  const now = new Date("2026-05-22T12:00:00Z")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when the target is null", () => {
    const { container } = render(<Countdown target={null} label="Starts in" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the target is in the past", () => {
    const past = new Date(now.getTime() - 1_000).toISOString()
    const { container } = render(<Countdown target={past} label="Starts in" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders days, hours, minutes, and seconds for a future target", () => {
    // 5 days, 6 hrs, 7 min, 8 sec ahead — distinct values per segment so each
    // `getByText` assertion is unambiguous.
    const target = new Date(
      now.getTime() + (5 * 86_400 + 6 * 3_600 + 7 * 60 + 8) * 1000
    ).toISOString()

    render(<Countdown target={target} label="Starts in" />)

    expect(screen.getByText("05")).toBeInTheDocument()
    expect(screen.getByText("06")).toBeInTheDocument()
    expect(screen.getByText("07")).toBeInTheDocument()
    expect(screen.getByText("08")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    expect(screen.getByText("hrs")).toBeInTheDocument()
    expect(screen.getByText("min")).toBeInTheDocument()
    expect(screen.getByText("sec")).toBeInTheDocument()
  })

  it("shows the target date in the formatted text", () => {
    // Fixed target so the year in the formatted output is predictable.
    const target = "2026-06-01T17:00:00Z"
    render(<Countdown target={target} label="Starts in" />)
    // Year is locale-agnostic; verifies the formatted date string rendered.
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it("ticks down once per second", () => {
    const target = new Date(now.getTime() + 10_000).toISOString()
    render(<Countdown target={target} label="Starts in" />)
    expect(screen.getByText("10")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3_000)
    })

    expect(screen.getByText("07")).toBeInTheDocument()
  })

  it("shows the label when provided", () => {
    const target = new Date(now.getTime() + 60_000).toISOString()
    render(<Countdown target={target} label="Tournament starts in" />)
    expect(screen.getByText("Tournament starts in")).toBeInTheDocument()
  })

  it("retires itself when the target reaches zero", () => {
    const target = new Date(now.getTime() + 1_500).toISOString()
    const { container } = render(
      <Countdown target={target} label="Starts in" />
    )
    expect(screen.getByText("01")).toBeInTheDocument() // 1 second remaining

    act(() => {
      vi.advanceTimersByTime(2_000) // past target
    })

    expect(container).toBeEmptyDOMElement()
  })
})
