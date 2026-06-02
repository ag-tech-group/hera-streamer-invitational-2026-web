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
   * Game this tournament is played in, appended to the document / SEO title
   * for search context — `"Age of Empires II"` yields a title like
   * `"<name> (Hosted by <hostName>) — Age of Empires II"` (#179). Kept short on
   * purpose (no "Definitive Edition") so the title stays under the ~60-char
   * SERP truncation; the full product name lives in the meta description.
   * When unset, the title stays brand-only.
   */
  game?: string
  /**
   * Tournament slug used in the API path (`GET /v1/tournaments/{slug}/...`).
   *
   * Distinct from `slug` above: `slug` selects this build's config, while
   * this is the server-side tournament identifier the standings, live, and
   * matches queries are scoped to. The API is multi-tournament; this build
   * tracks the tournament with slug `"kings-gauntlet"`.
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
   * Tournament resource / info links — info video + trailer, handbook, wiki,
   * community invite (#273/#274/#276/#277). Distinct from `hostLinks`: those
   * are the host's own watch/support channels, these are "learn about / follow
   * the event" links. Rendered as a slim chip bar (`TournamentLinksBar`) below
   * the context cards rather than as a fifth card. Empty/unset → nothing renders.
   */
  tournamentLinks?: TournamentLink[]
  /**
   * Host display name, e.g. `"Hera"`. The promo card renders a localized
   * `"Hosted by {name}"` (the `hostLinks.hostedBy` key); the document title
   * uses a canonical English `"Hosted by {name}"` so it stays in sync with
   * the static `index.html` title (non-JS scrapers read that). When unset,
   * the card shows a generic `"Hosted by"` and the title is brand-only.
   */
  hostName?: string
  /**
   * Optional host brand mark shown beside the host label on the
   * `HostLinksCard` — an absolute `public/` path (e.g. `"/hera-logo.png"`).
   * Keeps the host's own logo on the promo card while the component stays
   * generic (it takes no host-specific knowledge). When unset, the card
   * shows the label alone (#180).
   */
  hostLogo?: string
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
  /**
   * Optional sponsor name credited as a muted line under the prize-pool
   * amount (#156). Rendered via the `home.prizePool.sponsoredBy` i18n
   * template, so the name itself isn't translated — "Sponsored by World's
   * Edge" in EN, "Patrocinado por World's Edge" in ES.
   */
  prizeSponsor?: string
  /**
   * Optional URL the sponsor name links to (#183). When set,
   * `PrizePoolCard` wraps `prizeSponsor` in an external `<a>`; when unset,
   * the sponsor renders as plain text. Has no effect without
   * `prizeSponsor`.
   */
  prizeSponsorUrl?: string
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

/** A single tournament resource / info link rendered in the `TournamentLinksBar`. */
export interface TournamentLink {
  /** Short display label, e.g. `"Handbook"` or `"Liquipedia"`. */
  label: string
  /** Absolute URL (`https://…`). Opens in a new tab. */
  url: string
  /** Category, used to pick an icon. Unknown values fall back to a generic external-link glyph. */
  kind: TournamentLinkKind
  /**
   * Optional hover blurb shown on desktop via a `HoverCard` with a long open
   * delay — used sparingly (e.g. an easter-egg aside), so it only surfaces on a
   * deliberate, lingering hover. Omit for a plain link.
   */
  tooltip?: string
}

/**
 * Recognised `TournamentLink.kind` values. Each maps to an icon in
 * `TournamentLinksBar`: `discord` uses an inlined brand glyph (Lucide ships
 * none, like the host card's Patreon mark); the rest use Lucide category
 * icons. `other` is the generic external-link fallback.
 */
export type TournamentLinkKind =
  | "video"
  | "trailer"
  | "handbook"
  | "wiki"
  | "discord"
  | "other"
