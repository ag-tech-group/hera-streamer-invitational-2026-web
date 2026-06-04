/**
 * AoE2 player-colour slots, in canonical order: blue, red, green, yellow,
 * cyan, pink, gray, orange. The actual colours live in `index.css`
 * (`--team-pN` tokens, exposed per slot via the `data-team-color` aliases);
 * this module is the shared vocabulary plus the team → slot mapping, so the
 * standings Team column and the Teams tab colour a given team identically.
 */
export type TeamColorSlot =
  | "p1"
  | "p2"
  | "p3"
  | "p4"
  | "p5"
  | "p6"
  | "p7"
  | "p8"

export const TEAM_COLOR_SLOTS: readonly TeamColorSlot[] = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
]

/**
 * Builds a stable `teamId → colour slot` map from the full set of team ids.
 *
 * Colour follows **creation order**, not the raw id: the ids are sorted
 * ascending (≈ creation order) and assigned blue, red, green, … in AoE2 order
 * by their *ordinal position*. So the first-created team is always blue even
 * if its database id is 3 because earlier teams were deleted (#231) — the gap
 * doesn't leak into the palette. Past eight teams the palette wraps.
 *
 * Keying off a map (rather than the bare id) also means colour stays pinned to
 * a team's identity regardless of how the panels are *ordered* on screen, so
 * the Teams tab can sort by rank (#230) without the colours moving.
 *
 * Every surface that colours a team — the Teams tab, the standings Team chip,
 * the stats bars — must build this map from the same id set so a given team
 * paints identically everywhere.
 */
export function teamColorMap(teamIds: number[]): Map<number, TeamColorSlot> {
  const ordered = [...new Set(teamIds)].sort((a, b) => a - b)
  return new Map(
    ordered.map((id, i) => [id, TEAM_COLOR_SLOTS[i % TEAM_COLOR_SLOTS.length]])
  )
}

/**
 * The AoE2 player-colour slots (#146) as concrete `#rrggbb` hex.
 *
 * The canonical colours live in `index.css` as `--team-pN` tokens (oklch), but
 * echarts paints to a `<canvas>` and can't read CSS custom properties — so the
 * stats charts need the same palette as plain hex. These approximate the oklch
 * tokens closely enough to read as the same colour beside the HTML surfaces.
 */
export const TEAM_HEX: Record<TeamColorSlot, string> = {
  p1: "#3b82f6",
  p2: "#ef4444",
  p3: "#22c55e",
  p4: "#eab308",
  p5: "#06b6d4",
  p6: "#ec4899",
  p7: "#94a3b8",
  p8: "#f97316",
}

/**
 * Lightens a `#rrggbb` hex toward white by `amount` (0 = unchanged, 1 = white),
 * clamped to that range. Used to shade members within a team's hue on the
 * roster-depth bars (#300) so stacked segments of one team stay distinguishable
 * while still reading as that team's colour.
 */
export function lightenHex(hex: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount))
  const n = Number.parseInt(hex.slice(1), 16)
  const mix = (channel: number) => Math.round(channel + (255 - channel) * t)
  const r = mix((n >> 16) & 0xff)
  const g = mix((n >> 8) & 0xff)
  const b = mix(n & 0xff)
  const to2 = (channel: number) => channel.toString(16).padStart(2, "0")
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

/** How far a team's last teammate is lightened from the base hue (0 = none). */
const SHADE_MAX = 0.45
/** Fallback hue for an entity that isn't on any team roster. */
export const NEUTRAL_HEX = "#94a3b8"

/**
 * Maps each id to its team's hue, lightening teammates apart within that hue so
 * same-team series stay distinguishable while still reading as the team colour.
 *
 * `ids` is consumed in priority order (e.g. current rank): the first teammate
 * keeps the full base hue and each subsequent one is lightened further toward
 * white, up to `SHADE_MAX`. Shared by the position bump chart (#299) and the elo
 * race (#301) so a player's shade matches across both surfaces. An id with no
 * team (or a team with no base hue) falls back to `NEUTRAL_HEX`.
 */
export function shadeByTeam(
  ids: number[],
  teamIdById: Map<number, number>,
  baseHexByTeamId: Map<number, string>
): Map<number, string> {
  const teammates = new Map<number, number[]>()
  for (const id of ids) {
    const teamId = teamIdById.get(id) ?? -1
    const group = teammates.get(teamId)
    if (group) group.push(id)
    else teammates.set(teamId, [id])
  }
  const color = new Map<number, string>()
  for (const [teamId, group] of teammates) {
    const base = baseHexByTeamId.get(teamId) ?? NEUTRAL_HEX
    group.forEach((id, k) => {
      color.set(
        id,
        group.length > 1
          ? lightenHex(base, (k / (group.length - 1)) * SHADE_MAX)
          : base
      )
    })
  }
  return color
}
