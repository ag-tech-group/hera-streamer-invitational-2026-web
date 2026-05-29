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
 * Stable colour slot for a team, keyed on its id so the colour never shifts
 * with the rankings: team 1 → blue, 2 → red, 3 → green, … in AoE2 order. Past
 * eight teams the palette wraps. Team ids are positive, so `teamId - 1` is a
 * valid index.
 */
export function teamColorSlot(teamId: number): TeamColorSlot {
  return TEAM_COLOR_SLOTS[(teamId - 1) % TEAM_COLOR_SLOTS.length]
}
