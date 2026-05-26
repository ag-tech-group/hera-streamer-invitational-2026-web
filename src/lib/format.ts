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
 * Builds the canonical aoe2insights profile URL for a player. `profile_id` is
 * the relic ID that aoe2insights uses as its `/user/<id>` path segment — the
 * same identifier the API surfaces on every standings row. Used wherever a
 * player alias should link out to their broader history.
 */
export function aoe2insightsPlayerUrl(profileId: number): string {
  return `https://www.aoe2insights.com/user/${profileId}`
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
