import type { Tournament } from "@/types"

/**
 * Placeholder config for this build's tournament.
 *
 * `name` is deliberately generic — the real tournament name, branding, and
 * player roster land with the host handoff (issue #5). `apiTournamentSlug`
 * `"default"` is the API's sole tournament for now — its standings, live,
 * and matches endpoints are what this build reads.
 */
export const heraStreamerInvitational2026: Tournament = {
  slug: "hera-streamer-invitational-2026",
  name: "AoE2: DE 1v1 Invitational",
  apiTournamentSlug: "default",
}
