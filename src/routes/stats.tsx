import { createFileRoute } from "@tanstack/react-router"

// Route definition only — the component lives in `stats.lazy.tsx` so echarts
// ships in the lazily-loaded /stats chunk rather than the main or routes
// bundle (the routes-*.js size budget is tight). See #164.
export const Route = createFileRoute("/stats")({})
