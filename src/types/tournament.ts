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
  /**
   * Promotional links surfaced on the standings page (channels, donation
   * pages, etc.). The frontend renders whatever is configured; the API has
   * no opinion about host promo content. When unset or empty,
   * `HostLinksCard` renders nothing.
   */
  hostLinks?: HostLink[]
  /**
   * Eyebrow label on the `HostLinksCard` (e.g., `"Hosted by Hera"`). When
   * unset, the component falls back to a generic `"Hosted by"`.
   */
  hostLabel?: string
  /**
   * ISO 4217 currency code (e.g. `"USD"`, `"EUR"`) used to format the
   * tournament's prize-pool display (#156). The amount itself is mutable
   * tournament metadata served by the API as integer minor units
   * (`TournamentInfo.prizePoolCents`); the currency is fixed for the
   * event so it lives in the per-build config — the API stays
   * currency-agnostic and generic. When unset, `PrizePoolCard` renders
   * nothing even if the API has a value.
   */
  prizeCurrency?: string
}

/** A single host-channel / donation / social link rendered on the standings page. */
export interface HostLink {
  /** Short display label, e.g. `"Twitch"` or `"Donate"`. */
  label: string
  /** Absolute URL (`https://…`). Opens in a new tab. */
  url: string
  /** Category, used to pick an icon. Unknown values fall back to a generic external-link glyph. */
  kind: HostLinkKind
}

/**
 * Recognised `HostLink.kind` values. Each maps to an icon in `HostLinksCard`.
 * Brand-named values (`twitch`, `youtube`, `patreon`) use the platform's own
 * mark; generic values (`stream`, `donate`, `social`, `other`) use a Lucide
 * glyph in the appropriate category.
 */
export type HostLinkKind =
  | "twitch"
  | "youtube"
  | "patreon"
  | "stream"
  | "donate"
  | "social"
  | "other"
