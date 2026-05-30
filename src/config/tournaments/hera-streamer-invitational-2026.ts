import type { Tournament } from "@/types"

/**
 * Config for this build's tournament. `apiTournamentSlug` `"default"` is the
 * API's sole tournament for now — its standings, live, and matches endpoints
 * are what this build reads. The host promo block (`hostLabel` + `hostLinks`)
 * feeds the `HostLinksCard` on the standings page.
 */
export const heraStreamerInvitational2026: Tournament = {
  slug: "hera-streamer-invitational-2026",
  name: "The King's Gauntlet",
  // Appended to the document/SEO title after the host label (#179).
  game: "Age of Empires II",
  apiTournamentSlug: "default",
  hostLabel: "Hosted by Hera",
  // Host brand mark headlining the promo card, demoted here from the navbar
  // when the tournament logo took over the site chrome (#180).
  hostLogo: "/hera-logo.png",
  // Currency that the API's `prize_pool_cents` is denominated in. USD is
  // the typical AoE2 invitational prize-pool currency; override per build
  // if this tournament's pool is in a different currency. (#156)
  prizeCurrency: "USD",
  // Sponsor credited under the prize-pool amount on `PrizePoolCard` (#156).
  // Links out to the studio's page on ageofempires.com (#183).
  prizeSponsor: "World's Edge",
  prizeSponsorUrl: "https://www.ageofempires.com/worlds-edge-studio/",
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
