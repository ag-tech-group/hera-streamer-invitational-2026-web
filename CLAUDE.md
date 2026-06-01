# Project guide

Real-time standings frontend for **The King's Gauntlet** — an AoE2: DE 1v1 invitational tournament hosted by Hera. Companion API: [aoe2-live-standings-api](https://github.com/ag-tech-group/aoe2-live-standings-api).

See [README.md](README.md) for the stack overview, install, and command reference.

## What's next

Build sequence and current status live in [GitHub Issues](../../issues). Each upcoming PR has its own issue with scope, acceptance criteria, and blocked-by references. Check there first to see what's open and what's blocked on what.

## Workflow

- **Lockstep with the API.** Endpoints are stubbed on the API repo first, then `pnpm generate-api` produces typed React Query hooks here. We do not maintain hand-written fixtures or speculative Zod schemas — the API is the source of truth for data shape.
- **Feature branches + PRs from day one.** No direct commits to `main`. CI must pass before merge.
- **Commit messages and PR descriptions** are written as if authored solely by the developer — no co-author lines, no tool-of-origin references.

## Architecture

- **Single root route `/`, served under a `/kings-gauntlet/` base.** Public traffic enters at `aoe2.criticalbit.gg/kings-gauntlet/` via [criticalbit-router](https://github.com/ag-tech-group/criticalbit-router), which passes the path straight through to the Netlify origin — the build's Vite `base` is `/kings-gauntlet/`, so the slug is part of every asset path rather than stripped (#167). Which tournament's config a build serves is chosen by the `VITE_TOURNAMENT_SLUG` build-time env var.
- **Real-time via SSE.** REST endpoints are the single source of truth for data. A single global SSE stream (`GET /v1/stream`) carries lightweight _nudge_ events — each just signals which resource changed via the SSE `event:` field (`standings` | `live` | `matches`), with a `{ polled_at }` payload and no data. On each nudge the consumer (`useLiveUpdates`) calls `queryClient.invalidateQueries()` for the matching query key, and the orval-generated REST hook refetches. Components stay simple `useQuery()` consumers; the cache is never written directly from the stream.
- **Adapter at the network boundary.** Generated API DTOs are mapped to UI-facing types via a thin adapter. Components never import generated API types directly — keeps API drift contained to one mapping file.
- **Public standings, authenticated admin.** The standings/teams views are fully public — no auth. A separate admin surface (`src/pages/admin/*`) manages tournament config, teams, players, and owners; it's gated by criticalbit auth via a shared `.criticalbit.gg` access cookie (the API client sends it with `credentials: "include"`). `isAdmin` is derived from `/v1/me`'s `owned_tournaments`. The template's original auth scaffolding was stripped in #1; the current criticalbit-auth integration was added later.

## Deploy

Deployed to Netlify; the public canonical URL is `aoe2.criticalbit.gg/kings-gauntlet/`, served via the path-based [criticalbit-router](https://github.com/ag-tech-group/criticalbit-router) proxying to the Netlify origin. (The earlier `hera-streamer-invitational-2026.criticalbit.gg` custom domain has been retired.) Do not deploy to bare `aoe2.criticalbit.gg` — that's reserved for a future general AoE2 site.

## Conventions

- The tournament launched publicly on 2026-06-01 as **The King's Gauntlet**, hosted by Hera. The name, host, and live player standings are now public — they appear in the site, the build config, and the v1.0.0 release — so the earlier embargo on naming tournament-sensitive details in public artifacts no longer applies.
