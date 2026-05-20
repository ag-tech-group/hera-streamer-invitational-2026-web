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
   * AoE2 leaderboard the standings are drawn from. The API serves standings
   * per leaderboard (`GET /v1/leaderboards/{id}/standings`), not per
   * tournament — `3` is the 1v1 Random Map ranked ladder (`SOLO_RM_RANKED`).
   */
  leaderboardId: number
}
