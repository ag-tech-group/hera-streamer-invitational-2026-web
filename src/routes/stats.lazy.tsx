import { createLazyFileRoute } from "@tanstack/react-router"

import { StatsPage } from "@/pages/stats/stats-page"

// Lazy component for `/stats` — keeps echarts (the heaviest dependency here)
// out of the main + routes bundles, loaded only when a viewer opens the tab.
export const Route = createLazyFileRoute("/stats")({
  component: StatsPage,
})
