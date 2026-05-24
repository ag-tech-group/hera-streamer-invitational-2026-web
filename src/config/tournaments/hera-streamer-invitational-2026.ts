import type { Tournament } from "@/types"

/**
 * Config for this build's tournament. `apiTournamentSlug` `"default"` is the
 * API's sole tournament for now — its standings, live, and matches endpoints
 * are what this build reads. The host promo block (`hostLabel` + `hostLinks`)
 * feeds the `HostLinksCard` on the standings page.
 */
export const heraStreamerInvitational2026: Tournament = {
  slug: "hera-streamer-invitational-2026",
  name: "AoE2: DE 1v1 Invitational",
  apiTournamentSlug: "default",
  hostLabel: "Hosted by Hera",
  hostLinks: [
    { label: "Twitch", url: "https://twitch.tv/hera", kind: "twitch" },
    {
      label: "YouTube",
      url: "https://www.youtube.com/@HeraAgeofEmpires2",
      kind: "youtube",
    },
    {
      label: "Donate",
      url: "https://streamelements.com/hera-5133/tip",
      kind: "donate",
    },
    {
      label: "Patreon",
      url: "https://www.patreon.com/cw/heraaoe2",
      kind: "patreon",
    },
  ],
}
