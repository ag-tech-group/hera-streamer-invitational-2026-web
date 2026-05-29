import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { searchUsers, type UserSearchResult } from "@/lib/auth-config"
import { cn } from "@/lib/utils"

/**
 * Type-ahead picker for criticalbit users (see web #82, #142). Debounces
 * the input, hits `GET /users/search` on the auth API, and surfaces
 * matches in a dropdown showing the display name with the email on a
 * second line (or the email alone when there's no display name), plus the
 * optional avatar. Rows with both display_name AND email null (Steam-
 * OAuth users pre-tos-gate) are filtered out — admins shouldn't grant
 * ownership to someone they can't identify, and the picker must never
 * fall back to rendering a raw UUID.
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
  placeholder,
  inputId,
}: {
  selected: UserSearchResult | null
  onSelect: (user: UserSearchResult | null) => void
  placeholder?: string
  inputId?: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query.trim(), 250)

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["users-search", debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  // Drop rows the picker can't render readably — Steam-OAuth users
  // pre-tos-gate carry both display_name=null and email=null, and the
  // contract is "never render a raw UUID." Defensive: today the API
  // can't even return such a row (search matches against display_name
  // OR email server-side, both null means nothing to match), but the
  // filter keeps the rule local to the consumer.
  const visibleResults = results.filter(
    (user) => user.display_name !== null || user.email !== null
  )

  if (selected) {
    return (
      <div className="border-input bg-muted/30 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-2 text-sm">
        <UserAvatar
          avatarUrl={selected.avatar_url}
          displayName={selected.display_name}
        />
        <span className="min-w-0 truncate">
          {selected.display_name ?? selected.email}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => onSelect(null)}
          aria-label={t("userSearch.clear")}
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
        placeholder={placeholder ?? t("userSearch.placeholder")}
        autoComplete="off"
      />
      {open && debouncedQuery.length > 0 ? (
        <SearchResults
          results={visibleResults}
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
  const { t } = useTranslation()
  return (
    <ul
      role="listbox"
      className="bg-popover absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-md"
    >
      {results.length === 0 && !isFetching ? (
        <li className="text-muted-foreground px-3 py-2 text-sm">
          {t("userSearch.noMatches")}
        </li>
      ) : null}
      {results.length === 0 && isFetching ? (
        <li className="text-muted-foreground px-3 py-2 text-sm">
          {t("userSearch.searching")}
        </li>
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
          <UserAvatar
            avatarUrl={user.avatar_url}
            displayName={user.display_name}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{user.display_name ?? user.email}</span>
            {/* Email on a second line when there's a display name — gives
                admins a unique identifier to disambiguate same-named users.
                Skipped when the name is already the email (no duplicate). */}
            {user.display_name && user.email ? (
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
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
