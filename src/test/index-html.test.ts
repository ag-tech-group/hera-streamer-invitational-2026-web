import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Guards the static SEO / social metadata in `index.html` (#179).
 *
 * The app is a client-rendered SPA, so this static <head> is the entire
 * surface a non-JS link-preview scraper (Discord, Slack, iMessage, X) ever
 * sees — anything set later from JS is invisible to them. A future edit that
 * silently drops a tag wouldn't fail a build; it would just quietly degrade
 * every share preview in the wild. These assertions make that a test failure
 * instead.
 *
 * Read from disk (not imported) because index.html is the build entry, not a
 * module. `process.cwd()` is the package root under vitest.
 */
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8")

const CANONICAL = "https://aoe2.criticalbit.gg/kings-gauntlet/"

/**
 * Pulls the `content` of a <meta> tag identified by `property=` (Open Graph)
 * or `name=` (Twitter, description). Tolerates multi-line tags and either
 * attribute order — `[^>]` spans newlines but stops at the tag's closing `>`.
 */
function metaContent(
  attr: "property" | "name",
  key: string
): string | undefined {
  const tag = html.match(new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`))
  return tag?.[0].match(/\bcontent="([^"]*)"/)?.[1]
}

describe("index.html SEO metadata", () => {
  it("keeps a keyword-bearing title and description", () => {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
    expect(title).toBe(
      "The King's Gauntlet (Hosted by Hera) — Age of Empires II"
    )
    expect(metaContent("name", "description")).toContain("Age of Empires II")
  })

  it("declares the canonical URL, matched by og:url", () => {
    const canonical = html
      .match(/<link\b[^>]*\brel="canonical"[^>]*>/)?.[0]
      .match(/\bhref="([^"]*)"/)?.[1]
    expect(canonical).toBe(CANONICAL)
    // og:url must agree with the canonical or the two signals fight.
    expect(metaContent("property", "og:url")).toBe(CANONICAL)
  })

  it("carries the Open Graph tags scrapers need for a rich preview", () => {
    expect(metaContent("property", "og:type")).toBe("website")
    expect(metaContent("property", "og:site_name")).toBeTruthy()
    // og:title mirrors <title> on purpose — keep them in lockstep.
    expect(metaContent("property", "og:title")).toBe(
      "The King's Gauntlet (Hosted by Hera) — Age of Empires II"
    )
    expect(metaContent("property", "og:description")).toContain(
      "Age of Empires II"
    )
  })

  it("carries the Twitter Card tags", () => {
    expect(metaContent("name", "twitter:card")).toBe("summary_large_image")
    expect(metaContent("name", "twitter:title")).toBeTruthy()
    expect(metaContent("name", "twitter:description")).toBeTruthy()
  })

  it("wires the social share image for OG + Twitter (#180)", () => {
    const OG_IMAGE = "https://aoe2.criticalbit.gg/kings-gauntlet/og-image.png"
    expect(metaContent("property", "og:image")).toBe(OG_IMAGE)
    expect(metaContent("property", "og:image:width")).toBe("1200")
    expect(metaContent("property", "og:image:height")).toBe("630")
    expect(metaContent("property", "og:image:alt")).toBeTruthy()
    // twitter:card is summary_large_image, so the large-format preview only
    // renders if twitter:image resolves — keep it pointed at the same asset.
    expect(metaContent("name", "twitter:image")).toBe(OG_IMAGE)
  })

  it("declares a search-grade favicon (>= 48px) so Google shows the icon (#296)", () => {
    // Google renders the favicon beside a search result from a rel="icon"
    // that's at least 48px square; below that it falls back to a generic
    // globe. The 16/32 icons don't clear that floor, so assert at least one
    // rel="icon" advertises a >= 48px square via its `sizes` attribute.
    const iconLinks = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) ?? []
    const largestSquare = Math.max(
      0,
      ...iconLinks.flatMap((tag) => {
        const size = tag.match(/\bsizes="(\d+)x(\d+)"/)
        return size ? [Math.min(Number(size[1]), Number(size[2]))] : []
      })
    )
    expect(largestSquare).toBeGreaterThanOrEqual(48)
  })

  it("sets a theme-color for mobile browser chrome", () => {
    expect(metaContent("name", "theme-color")).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it("embeds valid WebSite JSON-LD pointing at the canonical URL", () => {
    const raw = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )?.[1]
    expect(raw, "no ld+json block found").toBeTruthy()
    // Parsing is the real assertion: malformed JSON-LD is a silent SEO
    // no-op, so a syntax slip here should fail the suite, not ship.
    const data = JSON.parse(raw!)
    expect(data["@type"]).toBe("WebSite")
    expect(data.url).toBe(CANONICAL)
  })
})
