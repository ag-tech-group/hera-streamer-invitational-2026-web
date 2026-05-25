import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useUpdateTournamentV1TournamentsTournamentSlugPatch } from "@/api/generated/hooks/tournaments/tournaments"
import type { TournamentUpdate } from "@/api/generated/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { useTournament } from "@/hooks/use-tournament"
import { getUserMessage, parseApiError } from "@/lib/api-errors"
import type { TournamentInfo } from "@/types"

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
  const tournament = useTournament()

  if (tournament.isPending) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }

  if (tournament.isError || !tournament.data) {
    return (
      <p className="text-destructive text-sm">
        Couldn&apos;t load tournament details.
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
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [form, setForm] = useState<FormState>(() => toFormState(initialData))

  const mutation = useUpdateTournamentV1TournamentsTournamentSlugPatch({
    request: {
      headers: { "Idempotency-Key": idempotencyKey.current },
    },
    mutation: {
      onSuccess: () => {
        // Fresh key for the next logical operation, plus refetch so any
        // backend-side normalisation (whitespace trimming, etc.) is
        // reflected in `useTournament()` cache.
        idempotencyKey.reset()
        void queryClient.invalidateQueries({
          queryKey: [
            "getTournamentDetailV1TournamentsTournamentSlugGet",
            activeTournament.apiTournamentSlug,
          ],
        })
        toast.success("Tournament updated.")
      },
      onError: async (error) => {
        const normalized = await parseApiError(error)
        toast.error(getUserMessage(normalized), {
          description: normalized.requestId
            ? `Reference: ${normalized.requestId}`
            : undefined,
        })
      },
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      data: toUpdateBody(form),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        id="tournament-name"
        label="Name"
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
      />
      <Field
        id="tournament-leaderboard"
        label="Leaderboard ID"
        type="number"
        value={form.leaderboardId}
        onChange={(v) => setForm({ ...form, leaderboardId: v })}
      />
      <Field
        id="tournament-start"
        label="Start date"
        type="datetime-local"
        value={form.startDate}
        onChange={(v) => setForm({ ...form, startDate: v })}
      />
      <Field
        id="tournament-end"
        label="End date"
        type="datetime-local"
        value={form.endDate}
        onChange={(v) => setForm({ ...form, endDate: v })}
      />
      <Field
        id="tournament-finals"
        label="Grand finals date"
        type="datetime-local"
        value={form.grandFinalsDate}
        onChange={(v) => setForm({ ...form, grandFinalsDate: v })}
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

/** Local form state — strings everywhere so inputs can be controlled directly. */
interface FormState {
  name: string
  leaderboardId: string
  /** `datetime-local` value: `"YYYY-MM-DDTHH:mm"` in the viewer's local clock. */
  startDate: string
  endDate: string
  grandFinalsDate: string
}

function toFormState(tournament: TournamentInfo): FormState {
  return {
    name: tournament.name,
    leaderboardId: String(tournament.leaderboardId),
    startDate: toDatetimeLocal(tournament.startDate),
    endDate: toDatetimeLocal(tournament.endDate),
    grandFinalsDate: toDatetimeLocal(tournament.grandFinalsDate),
  }
}

/** Builds the PATCH body. Blank date fields become `null` (clears them). */
function toUpdateBody(form: FormState): TournamentUpdate {
  return {
    name: form.name,
    leaderboard_id: Number(form.leaderboardId),
    start_date: fromDatetimeLocal(form.startDate),
    end_date: fromDatetimeLocal(form.endDate),
    grand_finals_date: fromDatetimeLocal(form.grandFinalsDate),
  }
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

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
