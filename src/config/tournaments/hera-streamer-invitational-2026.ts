import type { Tournament } from "@/types"

/**
 * Placeholder config for this build's tournament.
 *
 * `name` is deliberately generic — the real tournament name, branding, and
 * player roster land with the host handoff (issue #5). `leaderboardId` 3 is
 * the 1v1 Random Map ranked ladder, which the standings query reads from.
 */
export const heraStreamerInvitational2026: Tournament = {
  slug: "hera-streamer-invitational-2026",
  name: "AoE2: DE 1v1 Invitational",
  leaderboardId: 3,
}
