# Deploy-Freeze Policy — Live-Event Peaks

## Policy

**No front-end deploys to `main` during scheduled marquee-match peak
windows.** A deploy is a Netlify rebuild + CDN republish of the SPA; during
peak viewership that is the single most disruptive routine action we take — it
forces a reload on the largest possible audience and floods the origin at the
worst moment. Land changes in an off-peak lull instead.

## Why (what 2026-06-01 proved)

Every deploy carries two viewer-facing costs, and both scale with how many
people are watching when it lands:

- **Stale code-split chunks.** Each build content-hashes chunk filenames, so a
  tab still running the previous build holds route imports pointing at chunks
  the new deploy has already replaced. Navigating to a lazy route then 404s on
  the dynamic import (`vite:preloadError` / "failed to fetch dynamically
  imported module"). The shipped auto-reload guard (`src/lib/chunk-reload.ts`,
  FE #261) recovers it — one guarded `location.reload()` picks up the current
  build — but that is still a forced reload for every open tab mid-match, and a
  per-deploy error blip in Sentry. On launch day these trickled in across every
  successive deploy.

- **CDN cache-cold thundering herd.** A deploy republishes the site and the
  edge cache for the changed surface goes cold; the first requests after the
  purge all miss and land on the origin at once — exactly at peak. (The edge
  Worker that fronts this domain also runs one invocation per request, cache
  hit or miss — see the router companion policy.)

Net: deploying at peak forces a reload on the most viewers _and_ stampedes the
origin, for changes that could just as easily wait for the next lull.

## The freeze window

- **Freeze** spans each scheduled marquee match: warmup → match → cooldown.
  Derive the times from the published match schedule. Default span: from
  **30 min before** a marquee match until **30 min after** its expected end.
- **Lulls** (e.g. overnight between match days) are the deploy windows.
  **Batch** changes into a lull and verify before it closes.

This is the same window the API and router freeze on; the three are frozen
together (see [Cross-service](#cross-service)).

## What to do instead

- Land and verify changes during a lull, well before the next peak. Confirm
  the live site loads a fresh build and the standings stream reconnects before
  the window reopens.
- Keep the `vite:preloadError` auto-reload guard (`src/lib/chunk-reload.ts`) as
  the safety net for the unavoidable deploy — it is the reason an off-schedule
  deploy degrades rather than breaks.

## Emergency override (a hotfix that must ship during a freeze)

A freeze is a default, not a hard lock. If a fix genuinely can't wait:

1. **Decide consciously** — the cost is a forced reload for every open tab and
   a cache-cold origin burst, mid-match, on the largest audience.
2. **Lean on the safety net** — the chunk-reload guard means open tabs
   self-recover on their next lazy-route navigation, and a small per-deploy
   `vite:preloadError` blip in Sentry is expected, not a regression.
3. **Verify after** — confirm the live site loads a fresh build and the
   standings stream reconnects before considering it done.

## Cross-service

This is one of three companion policies. The API (`aoe2-live-standings-api`)
and the edge router (`criticalbit-router`) carry their own peak-deploy risks (a
Cloud Run revision rollover spiking DB connections via SSE stickiness; a Worker
redeploy risking a whole-site edge outage). **Freeze all three together**
around a marquee match.

- **API** — `aoe2-live-standings-api` → `docs/deploy-freeze.md` (#198).
- **Router** — `criticalbit-router` #15 (deploy-freeze + Workers Builds
  auto-deploy, closing the `merge ≠ deploy` gap).

## Optional enforcement (future)

The policy is currently **manual discipline** — and on this repo a deploy is
simply a merge to `main` (Netlify auto-builds on every push). An opt-in guard
could enforce it: a Netlify build plugin or a CI pre-merge check that fails
(with a clear override) when a `DEPLOY_FREEZE` flag is set, or when `now()`
falls inside a configured event-window schedule. Deliberately **not added
yet** — a blocking guard on the deploy path is itself a deploy-path change, so
it wants its own calm-window rollout _and_ an always-available override. The
launch lesson is that tooling must never be able to block a genuine emergency
fix.

## References

- `src/lib/chunk-reload.ts` — the `vite:preloadError` auto-reload guard (FE
  #261); `src/lib/sentry.ts` — the chunk-reload teardown-noise suppression in
  `beforeSend` (FE #263).
- `aoe2-live-standings-api` → `docs/launch-lessons-learned.md` — the launch-day
  stale-chunk write-up and the cross-service incident record.
- #286 (this policy); companion deploy-freeze issues in the API (#198) and
  router (#15) repos.
