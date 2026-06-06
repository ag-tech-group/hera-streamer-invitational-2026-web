import { useTranslation } from "react-i18next"

import { useAnalytics } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { BioHint } from "@/pages/home/bio-hint"

/**
 * Which surface a `PlayerName` is rendered on. Tags the `player.profile.click`
 * and `player.bio.open` analytics so the same interaction logs a distinct origin
 * per view (#350) — without it, a profile click on the teams pill would merge
 * into the players-table metric.
 */
export type PlayerNameSource = "standings" | "teams"

/**
 * The shared player-name treatment for both the players table (`PlayerCell`) and
 * the teams pill (`PlayerPill`) — one component so the two can't drift (#350).
 * Renders the visible name as:
 *
 * - a link to the host-curated profile URL (`presentation.profileUrl`, #131)
 *   when set, plain text otherwise — a link always means a real profile (we
 *   don't synthesise one from the relic id, which doesn't match aoe2insights);
 *   and
 * - the bio disclosure (`BioHint`) beside it when the host set a bio: hover the
 *   name on desktop, tap the info button on touch.
 *
 * Hover *underlines* the name and does nothing else — the brightness glow the
 * old standings link used is gone (#350), here and on the table, so the
 * underline is the whole affordance.
 */
export function PlayerName({
  name,
  alias,
  profileId,
  bio,
  profileUrl,
  source,
  truncate = false,
}: {
  /** Resolved visible label (display-name override else the unified `name`). */
  name: string
  /**
   * Raw ladder handle for analytics. `null` for an unlinked member, which falls
   * back to the visible `name` — mirroring the standings adapter, where `alias`
   * is already coalesced to `name` for an unlinked entrant.
   */
  alias: string | null
  /** Relic profile id (null for an unlinked entrant) — carried for analytics. */
  profileId: number | null
  /** Host bio from the presentation bag; shows the disclosure when set. */
  bio?: string
  /** Host profile link from the presentation bag (#131); name links to it when set. */
  profileUrl?: string
  source: PlayerNameSource
  /**
   * Truncate the name to fit a constrained pill (teams) rather than keeping the
   * table column's single-line `whitespace-nowrap`. When truncating, the touch
   * bio wrapper also flexes (see the `triggerClassName` handed to `BioHint`) so
   * the name ellipsises while the info button keeps its size.
   */
  truncate?: boolean
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  // The raw handle is what analytics wants; an unlinked member has none, so use
  // the visible name (what the standings adapter falls `alias` back to anyway).
  const analyticsAlias = alias ?? name

  // The only per-surface layout difference: the pill shrinks a long name to an
  // ellipsis as a flex child, the table lets it run on one line. The brand/
  // underline treatment is identical either way.
  const nameSizing = truncate ? "min-w-0 flex-1 truncate" : "whitespace-nowrap"

  const nameNode = profileUrl ? (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={t("standings.viewProfile", { name })}
      // In the click handler so it fires once per real click, not on every
      // render of the (also hover-trigger) name node.
      onClick={() =>
        analytics.track("player.profile.click", {
          profileId,
          alias: analyticsAlias,
          source,
        })
      }
      // Underline-only hover (#350): no `hover:brightness-125`. `transition`
      // keeps the underline easing in like the rest of the row's affordances.
      className={cn(
        "text-brand font-medium underline-offset-2 transition hover:underline",
        nameSizing
      )}
    >
      {name}
    </a>
  ) : (
    // No profile URL: same weight + sizing so the layout doesn't shift, but
    // plain (no brand colour) so it reads as text, not a dead link.
    <span className={cn("font-medium", nameSizing)}>{name}</span>
  )

  if (!bio) return nameNode

  return (
    <BioHint
      bio={bio}
      name={name}
      profileId={profileId}
      alias={analyticsAlias}
      source={source}
      // Truncating surfaces need the touch wrapper (name + info button) to be a
      // shrinking flex box, so the name ellipsises while the button holds its
      // size; the table keeps BioHint's default inline wrapper.
      triggerClassName={
        truncate ? "flex min-w-0 flex-1 items-center gap-1.5" : undefined
      }
    >
      {nameNode}
    </BioHint>
  )
}
