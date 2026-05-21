import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LastUpdatedBadge } from "@/pages/home/last-updated-badge"

describe("LastUpdatedBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing before the first poll", () => {
    const { container } = render(<LastUpdatedBadge lastPolledAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows how long ago the standings were polled", () => {
    vi.setSystemTime(new Date("2026-05-21T12:00:30Z"))
    render(<LastUpdatedBadge lastPolledAt="2026-05-21T12:00:00Z" />)
    expect(screen.getByText(/updated 30s ago/i)).toBeInTheDocument()
  })

  it("recomputes the elapsed time as it ticks", () => {
    vi.setSystemTime(new Date("2026-05-21T12:00:00Z"))
    render(<LastUpdatedBadge lastPolledAt="2026-05-21T12:00:00Z" />)
    expect(screen.getByText(/just now/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText(/updated 30s ago/i)).toBeInTheDocument()
  })
})
