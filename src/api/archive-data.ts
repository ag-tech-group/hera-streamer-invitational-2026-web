import { activeTournament } from "@/config/tournaments"

/**
 * Archive-mode data layer (#375).
 *
 * In archive mode the live API is gone, so every read is served from static
 * JSON snapshots committed under `public/data/` (captured while the API was
 * still live). This module owns the mapping from an API request path to its
 * snapshot file and the fetch that returns it in the shape `orvalClient`
 * expects — so the generated API client stays completely untouched.
 *
 * The map is keyed on the request *path* (query string stripped): the only
 * parameterized read, head-to-head, varies only by `?limit=`, and the snapshot
 * holds the full set, so one file answers every limit. Anything not in the map
 * — a mutation, `/v1/me`, `/v1/flags` — never reaches here: those paths are
 * short-circuited at their own call sites in archive mode, so reaching this
 * module with an unmapped path is a programming error, surfaced as a thrown
 * query error rather than a silent dead request to a backend that's gone.
 */

const slug = activeTournament.apiTournamentSlug

/**
 * API path (no leading slash, no query) -> snapshot file under `public/data/`.
 * Mirrors the endpoint→file table in the #375 issue. Built from the active
 * tournament slug so a different build's slug maps correctly. Only the reads the
 * public surface actually performs are listed; `tournaments` (list) and
 * `civilizations` are captured too for completeness even though no current view
 * calls them, so the map stays a faithful copy of the documented contract.
 */
const STATIC_FILE_BY_PATH: Record<string, string> = {
  "v1/tournaments": "tournaments.json",
  [`v1/tournaments/${slug}`]: "tournament.json",
  [`v1/tournaments/${slug}/standings`]: "standings.json",
  [`v1/tournaments/${slug}/teams/standings`]: "teams-standings.json",
  [`v1/tournaments/${slug}/standings/history`]: "standings-history.json",
  [`v1/tournaments/${slug}/civ-stats`]: "civ-stats.json",
  [`v1/tournaments/${slug}/summary`]: "summary.json",
  [`v1/tournaments/${slug}/head-to-head`]: "head-to-head.json",
  [`v1/tournaments/${slug}/progression`]: "progression.json",
  "v1/civilizations": "civilizations.json",
}

/** Normalizes a request URL to its bare path: drop a leading slash and query. */
function normalizePath(url: string): string {
  return url.replace(/^\//, "").split("?")[0]
}

/**
 * The snapshot file backing a given API request URL, or `null` if none maps —
 * exported for the unit test and so callers can branch without catching.
 */
export function archiveFileForUrl(url: string): string | null {
  return STATIC_FILE_BY_PATH[normalizePath(url)] ?? null
}

/**
 * Fetches the static snapshot for an API request URL and returns it in the
 * `{ data, status, headers }` shape `orvalClient` produces, so the generated
 * hooks read `.data` off it exactly as they do for a live response.
 *
 * The snapshot lives at `<base>data/<file>.json`; `import.meta.env.BASE_URL` is
 * "/kings-gauntlet/" on the prod deploy (netlify.toml maps that prefix back to
 * the root `data/` file) and "/" everywhere else — the same base-aware pattern
 * as the version-check poll.
 */
export async function fetchArchiveData<T>(url: string): Promise<T> {
  const file = archiveFileForUrl(url)
  if (!file) {
    throw new Error(`No archived snapshot for "${url}" (archive mode).`)
  }

  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
  if (!response.ok) {
    throw new Error(
      `Archived snapshot ${file} returned ${response.status} ${response.statusText}.`
    )
  }

  const data = await response.json()
  return { data, status: response.status, headers: response.headers } as T
}
