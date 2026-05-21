/**
 * Display formatters for standings data.
 *
 * Pure, framework-agnostic helpers — kept out of components so the JSX stays
 * declarative and these stay unit-testable. No date library is in the stack,
 * so relative time is plain `Date` arithmetic.
 */

/** Distance from ASCII `A` to the Unicode regional-indicator symbol `🇦`. */
const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - "A".charCodeAt(0)

/**
 * Renders an ISO 3166-1 alpha-2 country code as its flag emoji (e.g. `"ca"`
 * → 🇨🇦). Each letter maps to its Unicode regional-indicator symbol; the pair
 * renders as a flag on every modern platform with zero assets or libraries.
 * Returns `null` for a missing or malformed code so callers can fall back.
 */
export function countryFlagEmoji(country: string | null): string | null {
  if (!country) return null
  const code = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return String.fromCodePoint(
    code.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET,
    code.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET
  )
}

/**
 * Formats an ISO-8601 timestamp as a short "time ago" string relative to
 * `now` — e.g. `"5m"`, `"3h"`, `"12d"`. Sub-minute and future timestamps both
 * collapse to `"now"`. Used for the recency of a player's last match.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date()
): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
