import { createFileRoute } from "@tanstack/react-router"

import { HomePage } from "@/pages/home/home-page"

// `/teams` renders the same HomePage as `/`, fixed to the Teams view (#163).
// Both routes share HomePage's data + layout; only the active standings table
// differs, derived from the route rather than local state.
export const Route = createFileRoute("/teams")({
  component: () => <HomePage view="teams" />,
})
