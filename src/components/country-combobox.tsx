import { useMemo, useState, type KeyboardEvent } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { filterCountries, getCountries } from "@/lib/countries"
import { countryCodeToFlagEmoji, flagEmojiToCountryCode } from "@/lib/format"
import { cn } from "@/lib/utils"

interface CountryComboboxProps {
  /** Forwarded to the trigger so an external `<Label htmlFor>` associates. */
  id?: string
  /** Stored flag value — a country flag emoji, or `""` when unset. */
  value: string
  onChange: (flag: string) => void
}

/**
 * A fixed-size flag-icons SVG with the same chip framing the standings table
 * uses, so the picker and the public table render flags identically.
 */
function Flag({ code }: { code: string }) {
  return (
    <span
      aria-hidden
      className={`fi fi-${code} ring-border shrink-0 rounded-[2px] text-base ring-1 ring-inset`}
    />
  )
}

/**
 * Searchable country picker for the player editor's flag field. Each option is
 * a flag + localized country name; selecting one stores that country's flag
 * *emoji*, so the presentation bag's `flag` value — and the standings
 * rendering that reads it — are unchanged from the old free-text emoji input.
 * An already-set value that isn't a recognized country (a custom glyph) still
 * shows, and can be cleared, but the list only offers countries.
 */
export function CountryCombobox({ id, value, onChange }: CountryComboboxProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)

  const countries = useMemo(() => getCountries(i18n.language), [i18n.language])
  const selectedCode = value ? flagEmojiToCountryCode(value) : null
  const selected = selectedCode
    ? countries.find((country) => country.code === selectedCode)
    : null
  const filtered = useMemo(
    () => filterCountries(countries, query),
    [countries, query]
  )

  const reset = () => {
    setOpen(false)
    setQuery("")
    setHighlight(0)
  }
  const choose = (code: string) => {
    onChange(countryCodeToFlagEmoji(code) ?? "")
    reset()
  }
  const clear = () => {
    onChange("")
    reset()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const pick = filtered[highlight]
      if (pick) choose(pick.code)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : reset())}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <Flag code={selected.code} />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">
              {t("admin.players.presentation.flagPlaceholder")}
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlight(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={t("admin.players.presentation.flagSearch")}
          aria-label={t("admin.players.presentation.flagSearch")}
          className="placeholder:text-muted-foreground w-full border-b px-3 py-2 text-sm outline-none"
        />
        <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
          {value ? (
            <li>
              <button
                type="button"
                onClick={clear}
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm"
              >
                {t("admin.players.presentation.flagClear")}
              </button>
            </li>
          ) : null}
          {filtered.map((country, index) => (
            <li key={country.code}>
              <button
                type="button"
                role="option"
                aria-selected={country.code === selectedCode}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(country.code)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm",
                  index === highlight && "bg-accent text-accent-foreground"
                )}
              >
                <Flag code={country.code} />
                <span className="truncate">{country.name}</span>
                {country.code === selectedCode ? (
                  <Check className="ms-auto size-4 shrink-0" />
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-muted-foreground px-2 py-6 text-center text-sm">
              {t("admin.players.presentation.flagNoResults")}
            </li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
