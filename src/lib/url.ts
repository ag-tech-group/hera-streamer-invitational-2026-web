/**
 * Returns `true` only for absolute `http(s)` URLs.
 *
 * Used as a guard wherever a value from the opaque `presentation` bag is about
 * to be used as an anchor `href`. Both the public standings table (player name
 * link, stream-channel icons) and the admin form render bag URLs directly,
 * without routing them through any sanitiser, so other schemes
 * (`javascript:`, `data:`, `vbscript:`, …) must be rejected here — otherwise a
 * bag value could smuggle in an XSS payload that executes in a public
 * visitor's browser on click.
 *
 * The API stores `presentation` as an opaque record and performs no
 * validation, so this is enforced at the adapter boundary (where the bag is
 * narrowed into UI types) and mirrored in the admin form for immediate
 * feedback as the host types.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
