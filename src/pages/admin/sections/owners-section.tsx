import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  getListTournamentOwnersV1TournamentsTournamentSlugOwnersGetQueryKey,
  useGrantTournamentOwnerV1TournamentsTournamentSlugOwnersPost,
  useListTournamentOwnersV1TournamentsTournamentSlugOwnersGet,
  useRevokeTournamentOwnerV1TournamentsTournamentSlugOwnersUserIdDelete,
} from "@/api/generated/hooks/owners/owners"
import type { TournamentOwnerRead } from "@/api/generated/types"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserSearchPicker } from "@/components/user-search-picker"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import type { UserSearchResult } from "@/lib/auth-config"

/**
 * Manage the active tournament's owners — list, grant, revoke.
 *
 * The owners list is a small unbounded set (a host plus any co-hosts
 * they've explicitly invited) so a plain list with a "remove" button per
 * row is fine; no pagination or virtualization needed.
 */
export function OwnersSection() {
  const query = useListTournamentOwnersV1TournamentsTournamentSlugOwnersGet(
    activeTournament.apiTournamentSlug
  )

  // The generated response type unions the 200 (`TournamentOwnerRead[]`) and
  // 422 (`HTTPValidationError`) shapes. ky throws on non-2xx so the success
  // case is the only `query.data` we ever see at runtime, but TS still
  // needs the explicit narrowing.
  const owners: TournamentOwnerRead[] =
    query.data?.status === 200 ? query.data.data : []

  return (
    <div className="flex flex-col gap-4">
      <OwnersList
        loading={query.isPending}
        error={query.isError}
        owners={owners}
      />
      <GrantOwnerForm />
    </div>
  )
}

function OwnersList({
  loading,
  error,
  owners,
}: {
  loading: boolean
  error: boolean
  owners: TournamentOwnerRead[]
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }
  if (error) {
    return (
      <p className="text-destructive text-sm">
        Couldn&apos;t load owners — requires sign-in.
      </p>
    )
  }
  if (owners.length === 0) {
    return <p className="text-muted-foreground text-sm">No owners yet.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {owners.map((owner) => (
        <OwnerRow key={owner.user_id} owner={owner} />
      ))}
    </ul>
  )
}

function OwnerRow({ owner }: { owner: TournamentOwnerRead }) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()

  const mutation =
    useRevokeTournamentOwnerV1TournamentsTournamentSlugOwnersUserIdDelete({
      request: {
        headers: { "Idempotency-Key": idempotencyKey.current },
      },
      mutation: {
        onSuccess: () => {
          idempotencyKey.reset()
          void queryClient.invalidateQueries({
            queryKey:
              getListTournamentOwnersV1TournamentsTournamentSlugOwnersGetQueryKey(
                activeTournament.apiTournamentSlug
              ),
          })
          toast.success("Owner revoked.")
        },
      },
    })

  return (
    <li className="bg-muted/30 flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <div className="flex flex-col">
        <span className="font-mono text-sm">{owner.user_id}</span>
        <span className="text-muted-foreground text-xs">
          Granted {new Date(owner.created_at).toLocaleDateString()}
        </span>
      </div>
      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            aria-label={`Revoke ${owner.user_id}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        }
        title="Revoke ownership?"
        description={
          <>
            User <span className="font-mono">{owner.user_id}</span> will lose
            admin access to this tournament.
          </>
        }
        confirmLabel="Revoke"
        destructive
        onConfirm={() =>
          mutation.mutate({
            tournamentSlug: activeTournament.apiTournamentSlug,
            userId: owner.user_id,
          })
        }
      />
    </li>
  )
}

function GrantOwnerForm() {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [selected, setSelected] = useState<UserSearchResult | null>(null)

  const mutation = useGrantTournamentOwnerV1TournamentsTournamentSlugOwnersPost(
    {
      request: {
        headers: { "Idempotency-Key": idempotencyKey.current },
      },
      mutation: {
        onSuccess: () => {
          idempotencyKey.reset()
          setSelected(null)
          void queryClient.invalidateQueries({
            queryKey:
              getListTournamentOwnersV1TournamentsTournamentSlugOwnersGetQueryKey(
                activeTournament.apiTournamentSlug
              ),
          })
          toast.success("Owner granted.")
        },
      },
    }
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected) return
        mutation.mutate({
          tournamentSlug: activeTournament.apiTournamentSlug,
          data: { user_id: selected.id },
        })
      }}
      className="border-border/60 flex flex-col gap-2 border-t pt-4"
    >
      <Label htmlFor="grant-owner-search">Grant ownership</Label>
      <div className="flex gap-2">
        <UserSearchPicker
          inputId="grant-owner-search"
          selected={selected}
          onSelect={setSelected}
          placeholder="Search by name or email"
        />
        <Button type="submit" disabled={mutation.isPending || !selected}>
          {mutation.isPending ? "Granting…" : "Grant"}
        </Button>
      </div>
    </form>
  )
}
