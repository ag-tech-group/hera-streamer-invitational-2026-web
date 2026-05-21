# Project guide

Real-time standings frontend for an AoE2: DE 1v1 invitational tournament. Companion API: [aoe2-live-standings-api](https://github.com/ag-tech-group/aoe2-live-standings-api).

See [README.md](README.md) for the stack overview, install, and command reference.

## What's next

Build sequence and current status live in [GitHub Issues](../../issues). Each upcoming PR has its own issue with scope, acceptance criteria, and blocked-by references. Check there first to see what's open and what's blocked on what.

## Workflow

- **Lockstep with the API.** Endpoints are stubbed on the API repo first, then `pnpm generate-api` produces typed React Query hooks here. We do not maintain hand-written fixtures or speculative Zod schemas — the API is the source of truth for data shape.
- **Feature branches + PRs from day one.** No direct commits to `main`. CI must pass before merge.
- **Commit messages and PR descriptions** are written as if authored solely by the developer — no co-author lines, no tool-of-origin references.

## Architecture

- **Single root route `/`.** The tournament slug never reaches the SPA; it's stripped by [criticalbit-router](https://github.com/ag-tech-group/criticalbit-router) before proxying. Tournament-specific config is selected by a build-time env var.
- **Real-time via SSE.** REST endpoints are the single source of truth for data. A single global SSE stream (`GET /v1/stream`) carries lightweight _nudge_ events — each just signals which resource changed via the SSE `event:` field (`standings` | `live` | `matches`), with a `{ polled_at }` payload and no data. On each nudge the consumer (`useLiveUpdates`) calls `queryClient.invalidateQueries()` for the matching query key, and the orval-generated REST hook refetches. Components stay simple `useQuery()` consumers; the cache is never written directly from the stream.
- **Adapter at the network boundary.** Generated API DTOs are mapped to UI-facing types via a thin adapter. Components never import generated API types directly — keeps API drift contained to one mapping file.
- **No auth.** The standings page is fully public; the template's auth wiring was stripped in #1.

## Deploy

Deploys to `hera-streamer-invitational-2026.criticalbit.gg`. Public traffic enters via the path-based router at `aoe2.criticalbit.gg/<final-slug>` (slug TBD). Do not deploy to bare `aoe2.criticalbit.gg` — that's reserved for a future general AoE2 site.

## Conventions

- Tournament-sensitive details (host name, player list, final tournament name) stay out of public artifacts. The repo is public; commits, PR titles/bodies, issues, and the README should remain generic on those points until the host announces.
