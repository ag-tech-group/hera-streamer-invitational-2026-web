import type { Tournament } from "@/types"

/**
 * Config for this build's tournament. `apiTournamentSlug` is the routing
 * key the API serves this tournament under — its standings, live, and
 * matches endpoints are what this build reads. The host promo block
 * (`hostName` + `hostLinks`) feeds the `HostLinksCard` on the standings
 * page.
 */
export const heraStreamerInvitational2026: Tournament = {
  slug: "hera-streamer-invitational-2026",
  name: "The King's Gauntlet",
  // Appended to the document/SEO title after the host label (#179).
  game: "Age of Empires II",
  apiTournamentSlug: "kings-gauntlet",
  hostName: "Hera",
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
  // Promo links rendered by `HostLinksCard`. These are build-config and the
  // sole source for the card — distinct from the admin-saved `host_stream_urls`
  // (#225), which the API uses only for host-liveness detection. The Twitch /
  // YouTube URLs here may duplicate that list; that's intentional (the flat
  // list can't carry these labels/kinds/order).
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
  // Tournament resource / info links rendered as a slim chip bar below the
  // context cards (#273/#274/#276/#277) — distinct from `hostLinks` (the host's
  // watch/support channels); these are "learn about / follow the event" links.
  tournamentLinks: [
    {
      label: "Tournament Details",
      url: "https://www.youtube.com/watch?v=zQag90FLvDw",
      kind: "video",
    },
    {
      label: "Trailer",
      url: "https://www.youtube.com/watch?v=kN8QTpaII_0",
      kind: "trailer",
    },
    {
      label: "Handbook",
      url: "https://docs.google.com/document/d/e/2PACX-1vQHOlzB6Zc8xWqLJEtqy26atxFKYZ5PjWZoQ-h2rkFl5W331Dz0r6MuY2UpMSOiUgjgCBOuGKReKDeJ/pub",
      kind: "handbook",
    },
    {
      label: "Liquipedia",
      url: "https://liquipedia.net/ageofempires/The_King%27s_Gauntlet",
      kind: "wiki",
    },
    {
      label: "Discord",
      url: "https://discord.com/invite/Vj936kargR",
      kind: "discord",
    },
  ],
}
