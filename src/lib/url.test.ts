import { describe, expect, it } from "vitest"

import { isHttpUrl } from "@/lib/url"

describe("isHttpUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(isHttpUrl("http://example.com")).toBe(true)
    expect(isHttpUrl("https://www.aoe2insights.com/user/12449433/")).toBe(true)
    expect(isHttpUrl("https://twitch.tv/handle")).toBe(true)
  })

  it("rejects script-bearing schemes (the XSS vectors this guards)", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isHttpUrl("vbscript:msgbox(1)")).toBe(false)
  })

  it("rejects other non-http schemes and unparseable values", () => {
    expect(isHttpUrl("mailto:hera@example.com")).toBe(false)
    expect(isHttpUrl("ftp://example.com")).toBe(false)
    expect(isHttpUrl("//example.com")).toBe(false)
    expect(isHttpUrl("not a url")).toBe(false)
    expect(isHttpUrl("")).toBe(false)
  })
})
