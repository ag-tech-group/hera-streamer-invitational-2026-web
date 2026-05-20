import { useListLeaderboardsV1LeaderboardsGet } from "@/api/generated/hooks/leaderboards/leaderboards"

export function HomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Live Standings</h1>
      <p className="text-muted-foreground max-w-md text-center">
        Real-time standings for an Age of Empires II: Definitive Edition 1v1
        invitational tournament. Currently in development.
      </p>
      <ApiSmokeProbe />
    </div>
  )
}

/**
 * Wire-verification probe for the generated API client.
 *
 * Intentionally throwaway: bypasses the adapter convention (see CLAUDE.md)
 * by reaching into a generated hook directly. Exists only to prove the
 * orval-generated client + CORS + TLS round-trip works against the live
 * preview API. Delete this once the real `useStandings(slug)` hook lands
 * via the adapter in PR 1 (issue #2).
 */
function ApiSmokeProbe() {
  const { data, isLoading, isError } = useListLeaderboardsV1LeaderboardsGet()
  let status: string
  if (isLoading) status = "loading…"
  else if (isError) status = "request failed"
  else {
    // Orval+ky wraps the response body in `{ data, status, headers }`, so the
    // envelope's `items[]` lives at `data.data.items`. The double-`data` is the
    // unergonomic-but-temporary shape; the adapter PR will smooth this over.
    status = `${data?.data?.items?.length ?? 0} leaderboards available`
  }

  return (
    <p className="text-muted-foreground text-xs">
      <span className="font-mono">API:</span> {status}
    </p>
  )
}
