import type { Tournament } from "@/types"
import { heraStreamerInvitational2026 } from "./hera-streamer-invitational-2026"

/**
 * Every tournament this app can be built for, keyed by slug.
 *
 * The active one is chosen at build time by `VITE_TOURNAMENT_SLUG`. Each new
 * tournament adds one config module and one entry here.
 */
const TOURNAMENTS: Record<string, Tournament> = {
  [heraStreamerInvitational2026.slug]: heraStreamerInvitational2026,
}

const DEFAULT_SLUG = heraStreamerInvitational2026.slug

const requestedSlug = import.meta.env.VITE_TOURNAMENT_SLUG ?? DEFAULT_SLUG

const resolved = TOURNAMENTS[requestedSlug]

// Fail loudly on a misconfigured build rather than rendering the wrong
// tournament: an unknown slug is a deploy-time mistake, not a runtime state.
if (!resolved) {
  throw new Error(
    `Unknown VITE_TOURNAMENT_SLUG "${requestedSlug}". ` +
      `Known slugs: ${Object.keys(TOURNAMENTS).join(", ")}.`
  )
}

/** The tournament this build serves. */
export const activeTournament: Tournament = resolved
