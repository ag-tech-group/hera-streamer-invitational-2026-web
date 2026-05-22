/**
 * Build-time configuration for a single tournament.
 *
 * One config is selected per build by the `VITE_TOURNAMENT_SLUG` env var (see
 * `src/config/tournaments`). The slug itself never reaches the running SPA —
 * criticalbit-router strips it before proxying (see CLAUDE.md).
 */
export interface Tournament {
  /** Stable identifier; matches the config filename and `VITE_TOURNAMENT_SLUG`. */
  slug: string
  /**
   * Display name shown in the UI. Intentionally generic until the host
   * announces — real branding lands with the host handoff (issue #5).
   */
  name: string
  /**
   * Tournament slug used in the API path (`GET /v1/tournaments/{slug}/...`).
   *
   * Distinct from `slug` above: `slug` selects this build's config, while
   * this is the server-side tournament identifier the standings, live, and
   * matches queries are scoped to. The API is multi-tournament; this build
   * tracks the tournament with slug `"default"`.
   */
  apiTournamentSlug: string
}
