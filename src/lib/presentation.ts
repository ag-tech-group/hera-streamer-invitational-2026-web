/**
 * The host-set Display name from a roster entry's `presentation` bag, or
 * `undefined` when none is set.
 *
 * The bag is opaque (`Record<string, unknown>`) and never validated by the
 * API, so the type is guarded before it's trusted — the same narrowing the
 * standings adapter and the presentation editor do. A blank override counts
 * as absent so callers fall back to the ladder `alias` rather than rendering
 * an empty name. The trimmed value is returned so a padded override doesn't
 * render with stray whitespace.
 */
export function presentationDisplayName(
  presentation: unknown
): string | undefined {
  const name = (presentation as Record<string, unknown> | null | undefined)
    ?.displayName
  return typeof name === "string" && name.trim().length > 0
    ? name.trim()
    : undefined
}
