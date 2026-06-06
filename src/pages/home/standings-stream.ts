/**
 * Stream-tier helper shared across the standings (live dot, Watch cell, compact
 * Watch metric). Kept in its own module — not in `standings-cells.tsx` — so the
 * components file stays a clean Fast Refresh boundary (only component exports).
 */

/**
 * The Twitch game-category that marks a live stream as genuinely "playing
 * AoE2" (#328). The live dot + Watch icons stay brand-blue for this exact
 * value — or for a null/unknown category — and dim to the white "off-game"
 * tier only for a *different* non-null category (a confirmed off-game stream
 * like "Just Chatting").
 */
const AOE2_CATEGORY = "Age of Empires II"

/**
 * A *confirmed* off-game live stream: live, with a non-null category that
 * isn't AoE2. A null category (YouTube, or Twitch omitting it) stays on brand
 * — we never demote a stream we can't classify (#328). One function so the
 * live dot, the Watch cell, and the compact metric all agree on the tier.
 */
export function isOffGameStream(
  streamLive: boolean,
  streamCategory: string | null
): boolean {
  return (
    streamLive && streamCategory !== null && streamCategory !== AOE2_CATEGORY
  )
}
