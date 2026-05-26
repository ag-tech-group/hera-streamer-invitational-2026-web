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
 * Builds an aoe2insights search URL for a player by alias.
 *
 * We can't deep-link to `/user/<id>` because aoe2insights uses an internal
 * numeric ID for its URLs that does not match the relic profile_id our API
 * surfaces (the two happen to coincide for most accounts, but diverge for
 * some — typically Microsoft Store vs Steam accounts). Searching by alias
 * sidesteps the ID mismatch and lands on a one-result page for unambiguous
 * aliases.
 */
export function aoe2insightsPlayerUrl(alias: string): string {
  return `https://www.aoe2insights.com/search/?q=${encodeURIComponent(alias)}`
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
