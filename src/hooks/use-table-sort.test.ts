import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useTableSort } from "@/hooks/use-table-sort"

interface Row {
  name: string
  score: number | null
}

const ROWS: Row[] = [
  { name: "Charlie", score: 30 },
  { name: "Alice", score: 50 },
  { name: "Bob", score: null },
  { name: "Dave", score: 40 },
]

function getValue(row: Row, key: string) {
  if (key === "name") return row.name
  if (key === "score") return row.score
  return null
}

describe("useTableSort", () => {
  it("returns rows in original order when nothing is sorted", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Charlie",
      "Alice",
      "Bob",
      "Dave",
    ])
    expect(result.current.sortState).toBeNull()
  })

  it("applies the supplied default direction on first click", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("score", "desc"))
    expect(result.current.sortState).toEqual({
      key: "score",
      direction: "desc",
    })
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Alice", // 50
      "Dave", // 40
      "Charlie", // 30
      "Bob", // null — pinned last
    ])
  })

  it("flips direction on the second click of the same column", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("score", "desc"))
    act(() => result.current.sortBy("score", "desc"))
    expect(result.current.sortState).toEqual({ key: "score", direction: "asc" })
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Charlie", // 30
      "Dave", // 40
      "Alice", // 50
      "Bob", // null — still pinned last
    ])
  })

  it("clears sort on the third click of the same column", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("score", "desc"))
    act(() => result.current.sortBy("score", "desc"))
    act(() => result.current.sortBy("score", "desc"))
    expect(result.current.sortState).toBeNull()
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Charlie",
      "Alice",
      "Bob",
      "Dave",
    ])
  })

  it("clearSort jumps back to unsorted in one call", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("name", "asc"))
    expect(result.current.sortState).not.toBeNull()
    act(() => result.current.clearSort())
    expect(result.current.sortState).toBeNull()
    expect(result.current.sortedRows).toEqual(ROWS) // original order restored
  })

  it("resets to the new column's default direction when switching columns", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("score", "desc"))
    // Same direction would imply prev: "desc" → flip to "asc". Switching
    // columns ignores the previous state and applies the new default.
    act(() => result.current.sortBy("name", "asc"))
    expect(result.current.sortState).toEqual({ key: "name", direction: "asc" })
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Alice",
      "Bob",
      "Charlie",
      "Dave",
    ])
  })

  it("sorts strings locale-aware in ascending order", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("name", "asc"))
    expect(result.current.sortedRows.map((r) => r.name)).toEqual([
      "Alice",
      "Bob",
      "Charlie",
      "Dave",
    ])
  })

  it("pins nulls to the end regardless of direction", () => {
    const { result } = renderHook(() => useTableSort(ROWS, getValue))
    act(() => result.current.sortBy("score", "asc"))
    expect(result.current.sortedRows.at(-1)?.name).toBe("Bob")
    act(() => result.current.sortBy("score", "asc")) // flip to desc
    expect(result.current.sortedRows.at(-1)?.name).toBe("Bob")
  })
})
