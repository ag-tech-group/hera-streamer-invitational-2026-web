<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/logo-light.png">
  <img alt="AG Technology Group" src=".github/assets/logo-light.png" width="200">
</picture>

# Live Standings

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)

Real-time standings frontend for an Age of Empires II: Definitive Edition 1v1 invitational tournament.

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

| Variable               | Description                               | Default                              |
| ---------------------- | ----------------------------------------- | ------------------------------------ |
| `VITE_API_URL`         | Backend API URL                           | `/api`                               |
| `VITE_TOURNAMENT_SLUG` | Tournament config this build serves       | `hera-streamer-invitational-2026`    |
| `VITE_LOG_LEVEL`       | Minimum log level (debug/info/warn/error) | `debug` (dev), `warn` (prod)         |
| `OPENAPI_URL`          | OpenAPI spec URL for `pnpm generate-api`  | `http://localhost:8000/openapi.json` |

## License

Apache 2.0 — see [LICENSE](LICENSE).
