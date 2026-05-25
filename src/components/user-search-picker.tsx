import { useQuery } from "@tanstack/react-query"
import { User, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchUsers, type UserSearchResult } from "@/lib/auth-config"
import { cn } from "@/lib/utils"

/**
 * Type-ahead picker for criticalbit users (see web #82). Debounces the
 * input, hits `GET /users/search` on the auth API, and surfaces matches
 * in a dropdown rendered with `display_name` (or the user id as a
 * fallback) plus optional avatar.
 *
 * Two display modes:
 *   - **Empty** (no `selected`): the search input with an absolute-
 *     positioned results dropdown. Mouse-down on a result captures the
 *     selection before the input's blur would close the dropdown.
 *   - **Filled** (`selected` non-null): a compact chip with a clear (×)
 *     button so the user can pick a different match.
 *
 * Keyboard navigation isn't wired up in this v1 — sticks with click /
 * tap selection. The drag-and-drop revisit in #83 will likely replace
 * this surface for the team-member case; for owners-grant it's the
 * long-term picker.
 */
export function UserSearchPicker({
  selected,
  onSelect,
  placeholder = "Search by name or email",
  inputId,
}: {
  selected: UserSearchResult | null
  onSelect: (user: UserSearchResult | null) => void
  placeholder?: string
  inputId?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query.trim(), 250)

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["users-search", debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  if (selected) {
    return (
      <div className="border-input bg-muted/30 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-2 text-sm">
        <UserAvatar user={selected} />
        <span className="min-w-0 truncate">
          {selected.display_name ?? selected.id}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => onSelect(null)}
          aria-label="Clear selected user"
        >
          <X aria-hidden />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        // Slight delay so a click on a result fires *before* the input
        // loses focus and the dropdown unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && debouncedQuery.length > 0 ? (
        <SearchResults
          results={results}
          isFetching={isFetching}
          onSelect={(user) => {
            onSelect(user)
            setQuery("")
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function SearchResults({
  results,
  isFetching,
  onSelect,
}: {
  results: UserSearchResult[]
  isFetching: boolean
  onSelect: (user: UserSearchResult) => void
}) {
  return (
    <ul
      role="listbox"
      className="bg-popover absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-md"
    >
      {results.length === 0 && !isFetching ? (
        <li className="text-muted-foreground px-3 py-2 text-sm">
          No users match that search.
        </li>
      ) : null}
      {results.length === 0 && isFetching ? (
        <li className="text-muted-foreground px-3 py-2 text-sm">Searching…</li>
      ) : null}
      {results.map((user) => (
        <li
          key={user.id}
          role="option"
          aria-selected="false"
          // `onMouseDown` (not `onClick`) so the selection lands before the
          // input's blur tears the dropdown down.
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(user)
          }}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
          )}
        >
          <UserAvatar user={user} />
          <span className="min-w-0 truncate">
            {user.display_name ?? user.id}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Small circular avatar from `avatar_url` with a Lucide fallback.
 * Falls back gracefully when the upstream image 404s by hiding itself.
 */
function UserAvatar({ user }: { user: UserSearchResult }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="size-5 shrink-0 rounded-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    )
  }
  return <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
}

/**
 * Tiny debounced-value hook — returns a value that lags the input by
 * `delay` milliseconds. Used to gate API calls behind a brief pause
 * in typing so we don't fire a request per keystroke.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
