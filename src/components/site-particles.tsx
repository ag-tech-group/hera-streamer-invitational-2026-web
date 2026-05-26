/**
 * Total number of drifting particles. Deliberately small — atmosphere
 * should be felt, not counted. ~20 particles at random positions across
 * the viewport reads as a continuous ambient haze without feeling busy.
 */
const PARTICLE_COUNT = 20

/**
 * Per-particle randomized parameters, computed once at module load. This
 * keeps `Math.random` outside the component's render pass (which would
 * otherwise trip the react-hooks/purity rule) and produces the same
 * particle layout for the whole SPA session — re-renders never reshuffle
 * the positions, which would feel like flicker.
 */
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: -Math.random() * 15,
  duration: 12 + Math.random() * 10,
  drift: (Math.random() - 0.5) * 60,
  size: 2 + Math.random() * 3,
}))

/**
 * Slow-drifting brand-tinted particles rising from the bottom of the
 * viewport. CSS-only animation (no JS, no requestAnimationFrame), so the
 * cost is just a handful of compositor layers — the same kind of cheap
 * opacity/transform animation used by `.team-heartbeat`.
 *
 * Each particle's horizontal start, animation duration, delay, drift, and
 * size live in the module-level `PARTICLES` constant and are surfaced as
 * inline CSS custom properties on the `<span>`, so 20 particles share one
 * `@keyframes` rule.
 *
 * `prefers-reduced-motion: reduce` skips the particle styles entirely —
 * the spans still render but have no animation or layout, so reduced-
 * motion users see no drifting motes at all (the site still has the
 * atmosphere wash + everything else for atmosphere).
 */
export function SiteParticles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="site-particle"
          style={
            {
              "--particle-x": `${p.x}%`,
              "--particle-delay": `${p.delay}s`,
              "--particle-duration": `${p.duration}s`,
              "--particle-drift": `${p.drift}px`,
              "--particle-size": `${p.size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
