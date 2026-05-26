/**
 * Subtle team-coloured atmosphere wash applied site-wide. A pair of wide
 * radial gradients — blue blooming from the left, red blooming from the
 * right — built from the existing `--team-color-bg` tokens (≤ 8% in light,
 * slightly higher in dark to compensate for the absorbent base) so every
 * page in the SPA gets a directional team tint without competing with the
 * data on top.
 *
 * Originally scoped to the Teams view in #114; expanded site-wide so the
 * broadcast atmosphere is consistent across Players / Teams / Admin. Even
 * on pages without an L/R panel layout (Players, Admin) the split still
 * reads as "two-team tournament space" — the colour assignment isn't
 * literal panel mirroring, it's ambient room lighting.
 *
 * Fixed-positioned at `-z-10` so it sits behind page content but above the
 * body's noise + spotlight backdrop. `aria-hidden` + `pointer-events-none`
 * because it's pure atmosphere — screen readers and pointer interactions
 * walk straight through.
 */
export function SiteAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          "radial-gradient(ellipse 70vw 80vh at 0% 50%, var(--team-p1-bg), transparent 65%)," +
          "radial-gradient(ellipse 70vw 80vh at 100% 50%, var(--team-p2-bg), transparent 65%)",
      }}
    />
  )
}
