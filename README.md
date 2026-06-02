<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/logo-light.png">
  <img alt="AG Technology Group" src=".github/assets/logo-light.png" width="200">
</picture>

# Live Standings

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)

Real-time standings frontend for **The King's Gauntlet** — an Age of Empires II: Definitive Edition 1v1 invitational tournament hosted by Hera.

Scaffolded from the AG Tech Group [web-template](https://github.com/ag-tech-group/web-template) and paired with [aoe2-live-standings-api](https://github.com/ag-tech-group/aoe2-live-standings-api) (FastAPI + async PostgreSQL).

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **TanStack Router** (file-based, type-safe routing) and **TanStack Query** (server state + cache)
- **shadcn/ui** + **Tailwind CSS v4**
- **ky** HTTP client, **orval** for OpenAPI → typed React Query hooks
- **Vitest** + **Testing Library** + **MSW**

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at http://localhost:5173. Set `VITE_API_URL=http://localhost:8000` in a `.env` file to point at a local API instance.

## API Client Generation

Once the sibling API is running locally (or `OPENAPI_URL` points at a deployed instance), generate the typed client:

```bash
pnpm generate-api
```

This writes typed React Query hooks, TypeScript types, and standalone Zod schemas to `src/api/generated/`. The orval config is in `orval.config.ts`.

Frontend feature work is developed in lockstep with the API — endpoints are stubbed there first and the generated client is the only data layer the UI consumes (no hand-written fixtures).

## Commands

```bash
pnpm dev               # Dev server
pnpm build             # Production build
pnpm lint              # ESLint
pnpm test              # Vitest (watch)
pnpm test:run          # Vitest (single run)
pnpm test:coverage     # With coverage
pnpm generate-api      # Regenerate API client from OpenAPI spec
pnpm generate-routes   # Regenerate TanStack Router route tree
```

## Project Structure

```
src/
├── api/                  # ky client, orval mutator, DTO→UI adapters; generated/ is orval output
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── ...               # Theme provider, error boundary, 404 page
├── config/               # Build-time tournament config registry
├── hooks/                # Data hooks (useStandings) over the generated client
├── lib/                  # Analytics, feature flags, logger, error message helpers
├── pages/                # Page components
├── routes/               # TanStack Router file-based routes
├── test/                 # Vitest setup + test renderers
├── types/                # UI-facing domain types
└── main.tsx              # Entry point (providers, router, mutation cache)
```

## Environment Variables

### Runtime (bundled, `VITE_*` reach the browser)

| Variable                                   | Description                                                                                                                                                                                          | Default                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `VITE_API_URL`                             | Backend API URL                                                                                                                                                                                      | `/api`                            |
| `VITE_AUTH_URL`                            | Auth frontend URL (sign-in, profile management)                                                                                                                                                      | `https://auth.criticalbit.gg`     |
| `VITE_AUTH_API_URL`                        | Auth API URL (logout, token refresh, user search)                                                                                                                                                    | `https://auth-api.criticalbit.gg` |
| `VITE_TOURNAMENT_SLUG`                     | Tournament config this build serves                                                                                                                                                                  | `hera-streamer-invitational-2026` |
| `VITE_LOG_LEVEL`                           | Minimum log level (debug/info/warn/error)                                                                                                                                                            | `debug` (dev), `warn` (prod)      |
| `VITE_SENTRY_DSN`                          | Sentry project DSN — unset = SDK never initialises (zero events)                                                                                                                                     | unset                             |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`           | Performance trace sample rate (`0` – `1`)                                                                                                                                                            | `0`                               |
| `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`  | Session replay sample rate (`0` – `1`)                                                                                                                                                               | `0`                               |
| `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Replay sample rate on error (`0` – `1`)                                                                                                                                                              | `0`                               |
| `VITE_POSTHOG_KEY`                         | PostHog project key — unset = SDK never initialises (zero events)                                                                                                                                    | unset                             |
| `VITE_POSTHOG_HOST`                        | PostHog ingest host. Prod points this at the first-party `/relay` reverse proxy (see [PostHog analytics reverse proxy](#posthog-analytics-reverse-proxy)) so ad / privacy blockers don't drop events | `https://us.i.posthog.com`        |

### Build-time (used by tooling, not bundled)

| Variable            | Description                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAPI_URL`       | OpenAPI spec URL for `pnpm generate-api` (defaults to `http://localhost:8000/openapi.json`).                                                                                                                                                                                     |
| `COMMIT_REF`        | Auto-set by Netlify per build; baked into the bundle as Sentry's `release` tag. Locally falls back to `"dev"`.                                                                                                                                                                   |
| `SENTRY_AUTH_TOKEN` | Sentry auth token. With `SENTRY_ORG` + `SENTRY_PROJECT` set, the build creates a Sentry release, uploads source maps, tags the deploy environment (`deploy.env` from Netlify's `CONTEXT`), and associates commits for suspect-commit detection. All of it is skipped when unset. |
| `SENTRY_ORG`        | Sentry org slug — required together with `SENTRY_AUTH_TOKEN` + `SENTRY_PROJECT`.                                                                                                                                                                                                 |
| `SENTRY_PROJECT`    | Sentry project slug — required together with the other two.                                                                                                                                                                                                                      |

## Deploy

Deployed to Netlify and served to the public through the [criticalbit-router](https://github.com/ag-tech-group/criticalbit-router) (a Cloudflare Worker) at the canonical URL **`aoe2.criticalbit.gg/kings-gauntlet/`**. The router proxies that path to this site's Netlify origin; the app is built under a matching `/kings-gauntlet/` Vite `base`, so the slug is part of every asset path rather than stripped (#167).

### One-time Netlify setup

1. **Netlify dashboard → Add new site → Import an existing project**, pick this repo, branch `main`.
2. **Build settings** (auto-detected from `pnpm-lock.yaml` and `package.json`, but verify):
   - Build command: `pnpm build`
   - Publish directory: `dist`
   - Package manager: pnpm
3. **Environment variables** (Site configuration → Environment variables):
   - `VITE_API_URL` → `https://aoe2-live-standings-api.criticalbit.gg`
   - `VITE_TOURNAMENT_SLUG` → `hera-streamer-invitational-2026`
   - `VITE_LOG_LEVEL` → `warn`
   - `NODE_VERSION` → `24` (so Netlify installs Node 24 to match `package.json` engines)
4. **Routing** (no custom domain needed): the site is reached only through the criticalbit-router, which proxies `aoe2.criticalbit.gg/kings-gauntlet/*` to this site's default `*.netlify.app` origin (the worker's `HERA_STREAMER_INVITATIONAL_2026_ORIGIN` setting points at that `.netlify.app` hostname). Leave the Netlify site on its default domain — no `criticalbit.gg` custom domain or CNAME is required here. (An earlier setup pointed a `hera-streamer-invitational-2026.criticalbit.gg` custom domain straight at Netlify; it's been retired in favour of the router.)

### How it deploys

Netlify auto-builds on every push to `main` once the project is wired. The build runs `pnpm install` → `pnpm build` (which itself runs `generate-routes` → `tsc -b` → `vite build`) and serves the resulting `dist/` from its `*.netlify.app` origin, which the criticalbit-router fronts at `aoe2.criticalbit.gg/kings-gauntlet/`.

`netlify.toml` at the repo root configures production headers and routing in one place: the CSP and standard security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), long-lived `Cache-Control` for `/assets/*` (Vite-hashed bundles are immutable per build) with `must-revalidate` on `/index.html`, and the SPA fallback so deep links from the TanStack Router resolve through `index.html`.

### Deploy freeze (live-event peaks)

Netlify auto-deploys on every push to `main`, so a merge during a marquee match is a live deploy to the largest possible audience — forcing a stale-chunk reload on open tabs and a cache-cold origin burst at the worst moment. **Do not merge to `main` during scheduled peak windows** (default: from 30 min before a marquee match until 30 min after its expected end); land changes in an off-peak lull. Full policy, rationale, and the cross-service freeze (API + router) live in [`docs/deploy-freeze.md`](docs/deploy-freeze.md).

### PostHog analytics reverse proxy

PostHog ingestion is routed through a first-party path on the event domain so privacy / ad-block extensions — common in the AoE2 audience — don't silently drop events by blocking the `*.i.posthog.com` destinations. In production `VITE_POSTHOG_HOST` is set to `https://aoe2.criticalbit.gg/relay` (baked into `netlify.toml`'s `[context.production.environment]`, so it applies to `main` builds only — deploy previews fall back to direct ingestion). `posthog-js` therefore only ever talks to the same origin as the app, and the [criticalbit-router](https://github.com/ag-tech-group/criticalbit-router) Cloudflare Worker that fronts this domain proxies those paths to PostHog in a single hop:

- `/relay/static/*` → `https://us-assets.i.posthog.com/static/*` — the lazily-loaded SDK assets
- `/relay/*` → `https://us.i.posthog.com/*` — capture, `/decide`, `/flags`, `/array`

The Worker matches `/relay/*` (longest-prefix, so `/relay/static` wins for assets) ahead of its SPA fallback, so the app shell never shadows them. No CSP change is needed — `connect-src 'self'` already covers the first-party path; the explicit `us.i.posthog.com` / `us-assets.i.posthog.com` entries remain as the direct-ingestion fallback for any context where `VITE_POSTHOG_HOST` is unset. The proxy still needs `VITE_POSTHOG_KEY` set in the Netlify environment to emit anything.

The Worker's event-hub config carries these `/relay/*` routes and proxies them straight to PostHog; every other deeper path passes through to the Netlify origin that hosts the SPA (apex `/` → `/kings-gauntlet/` is a Worker redirect). This replaced an earlier setup where `/relay/*` fell through to Netlify and a pair of `netlify.toml` rewrites re-proxied it on to PostHog — a redundant second hop, removed in [criticalbit-router#10](https://github.com/ag-tech-group/criticalbit-router/issues/10).

**Verify after deploy:** load the site with an ad-blocker (e.g. uBlock Origin) enabled, then in DevTools → Network confirm analytics requests go to `aoe2.criticalbit.gg/relay/*` (`200`) rather than `*.i.posthog.com`, and that events arrive in PostHog. Quick non-blocker smoke test:

```sh
# SDK assets — expect 200, content-type: application/javascript
curl -sI https://aoe2.criticalbit.gg/relay/static/array.js | grep -i content-type
# decide/flags — expect PostHog JSON, not the SPA's text/html
curl -s 'https://aoe2.criticalbit.gg/relay/decide/?v=3'
```

> A misconfigured proxy drops **all** events (versus losing only blocked ones today), so this check gates calling it done.

### Path-router routing

The public slug is `kings-gauntlet`. The criticalbit-router proxies `aoe2.criticalbit.gg/kings-gauntlet/*` to this app's Netlify origin (set via the worker's `HERA_STREAMER_INVITATIONAL_2026_ORIGIN`). The aoe2 hub passes the path through unchanged rather than stripping the prefix, so the app is built under a matching `/kings-gauntlet/` Vite `base` and `netlify.toml` maps `/kings-gauntlet/*` onto the `dist/` files (#167). Changing the slug is a coordinated router + `base` + `netlify.toml` change.

## License

Apache 2.0 — see [LICENSE](LICENSE).
