/**
 * Display formatters for standings data.
 *
 * Pure, framework-agnostic helpers — kept out of components so the JSX stays
 * declarative and these stay unit-testable. No date library is in the stack,
 * so relative time is plain `Date` arithmetic.
 */

/**
 * Normalizes a country code to a lowercase ISO 3166-1 alpha-2 string, or
 * `null` when it is missing or malformed.
 *
 * Lowercase is the form `flag-icons` expects for its `fi-<code>` class; a
 * `null` result is the signal for callers to fall back to a generic icon.
 */
export function normalizeCountryCode(country: string | null): string | null {
  if (!country) return null
  const code = country.trim().toLowerCase()
  return /^[a-z]{2}$/.test(code) ? code : null
}

/**
 * Converts a country flag emoji to its lowercase ISO 3166-1 alpha-2 code,
 * or `null` for any emoji that isn't a standard two-regional-indicator
 * country flag (rainbow, pirate, England's tag sequence, etc.).
 *
 * Country flag emojis are deterministic: each is two regional-indicator
 * symbol letters in the codepoint range U+1F1E6..U+1F1FF, mapping directly
 * to A-Z. So `"🇺🇸"` → `[U, S]` → `"us"`.
 *
 * Why this exists: Windows ships no glyphs for the regional-indicator
 * range, so rendering a country flag emoji directly on Windows shows the
 * underlying letters (e.g. "US") instead of a flag image. Routing the
 * extracted code through the existing `flag-icons` SVG pipeline gives a
 * cross-platform flag for the (very common) case where the bag's flag
 * value happens to be a standard country emoji.
 */
export function flagEmojiToCountryCode(flag: string): string | null {
  const REGIONAL_A = 0x1f1e6
  const REGIONAL_Z = 0x1f1ff
  const points: number[] = []
  for (const ch of flag) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) return null
    points.push(cp)
  }
  if (points.length !== 2) return null
  if (points.some((cp) => cp < REGIONAL_A || cp > REGIONAL_Z)) return null
  return points
    .map((cp) => String.fromCharCode(0x41 + (cp - REGIONAL_A)))
    .join("")
    .toLowerCase()
}

/**
 * Converts a lowercase ISO 3166-1 alpha-2 code to its country flag emoji (two
 * regional-indicator codepoints) — the inverse of `flagEmojiToCountryCode`.
 * Returns `null` for a code that isn't a well-formed alpha-2.
 *
 * The admin country picker stores the emoji this returns, so the presentation
 * bag's `flag` value keeps the exact format a host would otherwise type by
 * hand and the standings rendering path stays unchanged.
 */
export function countryCodeToFlagEmoji(code: string): string | null {
  const normalized = normalizeCountryCode(code)
  if (!normalized) return null
  const REGIONAL_A = 0x1f1e6
  return [...normalized]
    .map((ch) => String.fromCodePoint(REGIONAL_A + (ch.charCodeAt(0) - 0x61)))
    .join("")
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

/**
 * Formats an ISO-8601 timestamp as a human "time ago" phrase with
 * second-level granularity — `"just now"`, `"8s ago"`, `"3m ago"`,
 * `"2h ago"`, `"5d ago"`. Future timestamps (clock skew) collapse to
 * `"just now"`.
 *
 * Distinct from `formatRelativeTime`: this one surfaces seconds, because it
 * drives the live "last updated" badge where freshness is the whole point.
 */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Strips an AoE2 replay's map-file extension (and surrounding whitespace) from a
 * raw map name, so a tooltip reads `Arabia` rather than `Arabia.rms`, or
 * `megarandom` rather than `megarandom.rms2`.
 *
 * The poller forwards the map exactly as the recorded game names it —
 * `<name>.rms` / `.rms2` for random maps, `.scx` / `.scx2` / `.aoe2scenario`
 * for scenarios — so this trims that one trailing extension while leaving the
 * (possibly multi-word) name's own spacing and casing untouched: `EM
 * Runestones.rms` → `EM Runestones`. Returns `""` only for an empty input.
 */
export function cleanMapName(raw: string): string {
  return raw
    .trim()
    .replace(/\.(rms\d*|scx\d*|aoe2scenario)$/i, "")
    .trim()
}
