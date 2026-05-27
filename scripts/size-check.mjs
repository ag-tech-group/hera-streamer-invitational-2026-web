#!/usr/bin/env node
/**
 * Bundle-size budget enforcer (#65).
 *
 * Runs after `vite build` and fails the build if any matched asset's
 * gzipped size exceeds its budget. Budgets are deliberately set with a
 * little headroom over the current sizes — they're a "did something
 * accidentally regress?" guardrail, not a sub-KB optimisation target.
 *
 * To re-baseline after a deliberate change: run `pnpm build`, copy the
 * "actual" numbers, and bump the matching `maxGzip` field. Keep budgets
 * within ~25% of actuals so accidental bloat surfaces quickly.
 *
 * Unmatched files are listed at the end as "uncovered" — handy for
 * spotting newly-emitted chunks that should grow their own budget entry.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

const DIST = "dist/assets"

const BUDGETS = [
  // Initial JS bundle (eager). PostHog has been lazy-loaded out of it
  // (#65); Sentry's SDK + browser-tracing + replay integrations ship in
  // this chunk (~40 KB gzip) once VITE_SENTRY_DSN is set at build time —
  // before that, the runtime DSN check tree-shakes the whole SDK out.
  // Headroom over the current ~170 KB covers near-term growth without
  // flapping on every small dep update.
  { pattern: /^index-.*\.js$/, maxGzip: 185_000, label: "main JS" },
  // Orval-generated API client + Zod schemas — chunked separately by
  // Rolldown because it's only imported from hooks the lazy router resolves.
  { pattern: /^api-.*\.js$/, maxGzip: 35_000, label: "API client chunk" },
  // TanStack Router code-split routes.
  { pattern: /^routes-.*\.js$/, maxGzip: 15_000, label: "routes chunk" },
  // PostHog SDK chunk — loaded async after first paint, doesn't block
  // initial render but still counts against the total payload. The chunk
  // name comes from `manualChunks` in vite.config.ts.
  {
    pattern: /^posthog-.*\.js$/,
    maxGzip: 75_000,
    label: "PostHog async chunk",
  },
  // CSS bundle. Bumped headroom would land here if the Tailwind utility set
  // grows or a font/icon CSS gets imported.
  { pattern: /^index-.*\.css$/, maxGzip: 25_000, label: "main CSS" },
]

const files = readdirSync(DIST)
const matched = new Set()
let failed = false

console.log("Bundle size check (gzipped):")
for (const budget of BUDGETS) {
  const hits = files.filter((f) => budget.pattern.test(f))
  if (hits.length === 0) {
    console.log(
      `  · ${budget.label}: no matching asset (pattern ${budget.pattern})`
    )
    continue
  }
  for (const f of hits) {
    matched.add(f)
    const bytes = gzipSync(readFileSync(join(DIST, f))).length
    const ok = bytes <= budget.maxGzip
    const status = ok ? "✓" : "✗"
    const actual = (bytes / 1024).toFixed(1)
    const budgetKb = (budget.maxGzip / 1024).toFixed(0)
    console.log(
      `  ${status} ${budget.label} (${f}): ${actual} KB  (budget ${budgetKb} KB)`
    )
    if (!ok) failed = true
  }
}

const uncovered = files.filter((f) => /\.(js|css)$/.test(f) && !matched.has(f))
if (uncovered.length > 0) {
  console.log("\nUncovered assets (no budget; consider adding one):")
  for (const f of uncovered) {
    const bytes = gzipSync(readFileSync(join(DIST, f))).length
    console.log(`  · ${f}: ${(bytes / 1024).toFixed(1)} KB gzip`)
  }
}

if (failed) {
  console.error("\nBundle size budget exceeded — see ✗ above.")
  process.exit(1)
}
