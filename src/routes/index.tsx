import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "@/pages/home/home-page"

// `/` renders the Players view; `/teams` (teams.tsx) renders the Teams view.
// HomePage takes the active view as a prop so the switch is URL-driven (#163).
export const Route = createFileRoute("/")({
  component: () => <HomePage view="players" />,
})
