import { useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useUpdateTournamentV1TournamentsTournamentSlugPatch } from "@/api/generated/hooks/tournaments/tournaments"
import type { TournamentUpdate } from "@/api/generated/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { useTournament } from "@/hooks/use-tournament"
import type { TournamentInfo } from "@/types"

/**
 * API limits for `host_stream_urls` (#225) — mirror the server's validation
 * client-side so an owner gets inline feedback before the PATCH round-trips.
 */
const MAX_HOST_STREAM_URLS = 5
const MAX_HOST_STREAM_URL_LENGTH = 256

/**
 * Editor for the active tournament's metadata.
 *
 * Wraps `PATCH /v1/tournaments/{slug}` with the idempotency-key contract
 * from #71: the same key is sent on every retry of the same logical
 * submission so the backend can replay its cached response. On success
 * the key is reset so the next submit starts a fresh logical operation.
 *
 * Dates are surfaced as `datetime-local` inputs (no timezone, viewer's
 * local clock) and converted to UTC ISO strings on submit. Empty inputs
 * are passed as `null` to clear the corresponding field.
 */
export function TournamentDetailsSection() {
  const { t } = useTranslation()
  const tournament = useTournament()

  if (tournament.isPending) {
    return (
      <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
    )
  }

  if (tournament.isError || !tournament.data) {
    return (
      <p className="text-destructive text-sm">
        {t("admin.tournament.loadError")}
      </p>
    )
  }

  // Splitting the form into a child component (mounted only once the data
  // is available) lets its `useState` initialiser run once with the seed
  // data — avoids the "setState in effect" anti-pattern that a single
  // component would hit when bridging async load → form state.
  return <TournamentDetailsForm initialData={tournament.data} />
}

function TournamentDetailsForm({
  initialData,
}: {
  initialData: TournamentInfo
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [form, setForm] = useState<FormState>(() => toFormState(initialData))
  // Per-row validation errors for the host-stream URL editor, keyed by row
  // index. Computed on submit; cleared on success.
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({})

  const mutation = useUpdateTournamentV1TournamentsTournamentSlugPatch({
    request: {
      headers: { "Idempotency-Key": idempotencyKey.current },
    },
    mutation: {
      onSuccess: () => {
        // Fresh key for the next logical operation, plus refetch so any
        // backend-side normalisation (whitespace trimming, etc.) is
        // reflected in `useTournament()` cache. The user-facing error
        // toast is fired centrally by `main.tsx`'s `MutationCache.onError`
        // — the per-mutation `onError` below is side-effect only (key
        // recovery on `idempotency_key_reused`) and never toasts, so the
        // two don't compete.
        idempotencyKey.reset()
        setUrlErrors({})
        void queryClient.invalidateQueries({
          queryKey: [
            "getTournamentDetailV1TournamentsTournamentSlugGet",
            activeTournament.apiTournamentSlug,
          ],
        })
        toast.success(t("admin.tournament.successToast"))
      },
      onError: idempotencyKey.resetOnReusedKey,
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateHostStreamUrls(form.hostStreamUrls, t)
    setUrlErrors(errors)
    if (Object.keys(errors).length > 0) return
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      data: toUpdateBody(form),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/*
       * Two-column grid on `sm:` and up packs the form denser than a
       * full-width single column does — at the admin page's `max-w-4xl`
       * a single-column stack leaves ~600px of empty space next to every
       * input. `Name` spans both columns since the value can be longer
       * than a date cell can comfortably hold.
       */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="tournament-name"
          label={t("admin.tournament.nameLabel")}
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          className="sm:col-span-2"
        />
        <Field
          id="tournament-start"
          label={t("admin.tournament.startDate")}
          type="datetime-local"
          value={form.startDate}
          onChange={(v) => setForm({ ...form, startDate: v })}
        />
        <Field
          id="tournament-finals"
          label={t("admin.tournament.grandFinalsDate")}
          type="datetime-local"
          value={form.grandFinalsDate}
          onChange={(v) => setForm({ ...form, grandFinalsDate: v })}
        />
        {/*
         * Label is the i18n key plus the build's display currency, so the
         * admin sees `Prize pool (USD)` rather than guessing the unit.
         * `activeTournament.prizeCurrency` is unset for builds that don't
         * surface a prize pool; the bare key reads fine there too.
         */}
        <Field
          id="tournament-prize-pool"
          label={
            activeTournament.prizeCurrency
              ? `${t("admin.tournament.prizePoolLabel")} (${activeTournament.prizeCurrency})`
              : t("admin.tournament.prizePoolLabel")
          }
          type="number"
          min={0}
          step={0.01}
          placeholder="0.00"
          value={form.prizePool}
          onChange={(v) => setForm({ ...form, prizePool: v })}
        />
      </div>
      <HostStreamUrlsEditor
        urls={form.hostStreamUrls}
        errors={urlErrors}
        onChange={(next) => setForm({ ...form, hostStreamUrls: next })}
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? t("admin.tournament.saving")
            : t("admin.tournament.save")}
        </Button>
      </div>
    </form>
  )
}

/**
 * Local form state — strings everywhere so inputs can be controlled
 * directly. `leaderboard_id` picks which AoE2 ladder feeds this
 * tournament's standings — changing it would swap the leaderboard
 * wholesale, so the form intentionally doesn't surface it; one-time
 * setup via the API.
 */
interface FormState {
  name: string
  /** `datetime-local` value: `"YYYY-MM-DDTHH:mm"` in the viewer's local clock. */
  startDate: string
  grandFinalsDate: string
  /**
   * Decimal display of the prize-pool amount in the build's currency (e.g.
   * `"5000.00"`). Empty string maps to a `null` `prize_pool_cents` on
   * submit — cleared, not zero.
   */
  prizePool: string
  /**
   * Editable rows for the host broadcast channel URLs (#225). Held as the
   * raw row values (may include in-progress blanks); blank rows are trimmed
   * out on submit so clearing every row sends `[]`.
   */
  hostStreamUrls: string[]
}

function toFormState(tournament: TournamentInfo): FormState {
  return {
    name: tournament.name,
    startDate: toDatetimeLocal(tournament.startDate),
    grandFinalsDate: toDatetimeLocal(tournament.grandFinalsDate),
    prizePool: toPrizePoolInput(tournament.prizePoolCents),
    hostStreamUrls: tournament.hostStreamUrls,
  }
}

/** Builds the PATCH body. Blank date / prize-pool fields become `null` (cleared). */
function toUpdateBody(form: FormState): TournamentUpdate {
  return {
    name: form.name,
    start_date: fromDatetimeLocal(form.startDate),
    grand_finals_date: fromDatetimeLocal(form.grandFinalsDate),
    prize_pool_cents: fromPrizePoolInput(form.prizePool),
    // Trim each row and drop blanks so a stray empty row doesn't block save
    // and clearing every row sends `[]` (the API treats that as "none").
    host_stream_urls: form.hostStreamUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
  }
}

/**
 * Validates the host-stream URL rows against the API's contract (#225):
 * at most {@link MAX_HOST_STREAM_URLS} non-blank entries, each no longer than
 * {@link MAX_HOST_STREAM_URL_LENGTH} characters. Blank rows are ignored (they
 * get trimmed out on submit). Returns a map of row index → error message;
 * an empty map means the rows are valid. Over-limit is reported on the first
 * row beyond the cap so the message has somewhere to render.
 */
function validateHostStreamUrls(
  urls: string[],
  t: (key: string, opts?: Record<string, unknown>) => string
): Record<number, string> {
  const errors: Record<number, string> = {}
  let kept = 0
  urls.forEach((url, index) => {
    const trimmed = url.trim()
    if (trimmed.length === 0) return
    kept += 1
    if (trimmed.length > MAX_HOST_STREAM_URL_LENGTH) {
      errors[index] = t("admin.tournament.hostStreamUrls.errorTooLong", {
        max: MAX_HOST_STREAM_URL_LENGTH,
      })
    } else if (kept > MAX_HOST_STREAM_URLS) {
      errors[index] = t("admin.tournament.hostStreamUrls.errorTooMany", {
        max: MAX_HOST_STREAM_URLS,
      })
    }
  })
  return errors
}

/** ISO timestamp → `"YYYY-MM-DDTHH:mm"` in the viewer's local clock. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `"YYYY-MM-DDTHH:mm"` (local) → UTC ISO string; blank → `null`. */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

/**
 * Integer cents → fixed-2-decimal display string (e.g. `512750` → `"5127.50"`).
 * Null comes through as an empty string so the form treats it as cleared.
 */
function toPrizePoolInput(cents: number | null): string {
  if (cents === null) return ""
  return (cents / 100).toFixed(2)
}

/**
 * Decimal display string → integer cents (e.g. `"5127.50"` → `512750`).
 * Empty input maps to `null` (clears the field). Non-numeric inputs also
 * collapse to `null` rather than ever emitting `NaN` to the API —
 * `parseFloat` is permissive, so the round-trip stays defensive at the
 * edge.
 */
function fromPrizePoolInput(value: string): number | null {
  if (!value) return null
  const dollars = parseFloat(value)
  if (Number.isNaN(dollars)) return null
  return Math.round(dollars * 100)
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  className,
  min,
  step,
  placeholder,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (next: string) => void
  className?: string
  min?: string | number
  step?: string | number
  placeholder?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        step={step}
        placeholder={placeholder}
      />
    </div>
  )
}

/**
 * Add / edit / remove editor for the tournament's host-stream channel URLs
 * (#225). Rows are plain text inputs; the parent owns the array and submit-time
 * trimming. "Add" is capped at {@link MAX_HOST_STREAM_URLS} rows so the count
 * can't exceed the API limit in the first place; per-row errors surface the
 * length check. This list drives server-side liveness detection only — it is
 * not what the promo card renders.
 */
function HostStreamUrlsEditor({
  urls,
  errors,
  onChange,
}: {
  urls: string[]
  errors: Record<number, string>
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const atLimit = urls.length >= MAX_HOST_STREAM_URLS

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t("admin.tournament.hostStreamUrls.label")}</Label>
      <p className="text-muted-foreground text-xs">
        {t("admin.tournament.hostStreamUrls.help", {
          max: MAX_HOST_STREAM_URLS,
        })}
      </p>
      {urls.length > 0 && (
        <ul className="flex flex-col gap-2">
          {urls.map((url, index) => (
            // Index key: rows are positional and only the parent reorders them
            // (via filter on remove), so the index is stable enough here.
            <li key={index} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  value={url}
                  aria-label={t("admin.tournament.hostStreamUrls.rowAria", {
                    index: index + 1,
                  })}
                  aria-invalid={errors[index] ? true : undefined}
                  placeholder={t(
                    "admin.tournament.hostStreamUrls.rowPlaceholder"
                  )}
                  onChange={(event) =>
                    onChange(
                      urls.map((u, i) => (i === index ? event.target.value : u))
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onChange(urls.filter((_, i) => i !== index))}
                  aria-label={t("admin.tournament.hostStreamUrls.removeAria", {
                    index: index + 1,
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {errors[index] && (
                <p className="text-destructive text-xs">{errors[index]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => onChange([...urls, ""])}
        >
          <Plus className="h-4 w-4" />
          {t("admin.tournament.hostStreamUrls.add")}
        </Button>
      </div>
    </div>
  )
}
