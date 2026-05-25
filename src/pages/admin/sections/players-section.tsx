import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey,
  useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost,
  useListPlayersV1TournamentsTournamentSlugPlayersGet,
  useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdDelete,
} from "@/api/generated/hooks/players/players"
import type { PlayerRead } from "@/api/generated/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { getUserMessage, parseApiError } from "@/lib/api-errors"

/**
 * Manage the active tournament's player roster — add / remove by
 * aoe2.net profile ID. The standings page consumes the same roster
 * downstream; on every successful write here we invalidate the
 * roster cache so the public table picks up the change on the
 * next render.
 */
export function PlayersSection() {
  const query = useListPlayersV1TournamentsTournamentSlugPlayersGet(
    activeTournament.apiTournamentSlug
  )

  // Narrow the generated 200|422 union — see the same comment in
  // `owners-section.tsx`.
  const players: PlayerRead[] =
    query.data?.status === 200 ? query.data.data.items : []

  return (
    <div className="flex flex-col gap-4">
      <PlayersList
        loading={query.isPending}
        error={query.isError}
        players={players}
      />
      <AddPlayerForm />
    </div>
  )
}

function PlayersList({
  loading,
  error,
  players,
}: {
  loading: boolean
  error: boolean
  players: PlayerRead[]
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }
  if (error) {
    return (
      <p className="text-destructive text-sm">Couldn&apos;t load roster.</p>
    )
  }
  if (players.length === 0) {
    return <p className="text-muted-foreground text-sm">No players yet.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {players.map((player) => (
        <PlayerRow key={player.profile_id} player={player} />
      ))}
    </ul>
  )
}

function PlayerRow({ player }: { player: PlayerRead }) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()

  const mutation =
    useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdDelete({
      request: {
        headers: { "Idempotency-Key": idempotencyKey.current },
      },
      mutation: {
        onSuccess: () => {
          idempotencyKey.reset()
          void queryClient.invalidateQueries({
            queryKey:
              getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey(
                activeTournament.apiTournamentSlug
              ),
          })
          toast.success("Player removed.")
        },
        onError: async (error) => surfaceError(error),
      },
    })

  return (
    <li className="bg-muted/30 flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{player.alias}</span>
        <span className="text-muted-foreground font-mono text-xs">
          profile_id {player.profile_id}
          {player.country ? ` · ${player.country}` : null}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            tournamentSlug: activeTournament.apiTournamentSlug,
            profileId: player.profile_id,
          })
        }
        aria-label={`Remove ${player.alias}`}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  )
}

function AddPlayerForm() {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [profileId, setProfileId] = useState("")

  const mutation = useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost({
    request: {
      headers: { "Idempotency-Key": idempotencyKey.current },
    },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        setProfileId("")
        void queryClient.invalidateQueries({
          queryKey: getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey(
            activeTournament.apiTournamentSlug
          ),
        })
        toast.success("Player added.")
      },
      onError: async (error) => surfaceError(error),
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate({
          tournamentSlug: activeTournament.apiTournamentSlug,
          data: { profile_id: Number(profileId) },
        })
      }}
      className="border-border/60 flex flex-col gap-2 border-t pt-4"
    >
      <Label htmlFor="add-player-profile-id">Add player</Label>
      <div className="flex gap-2">
        <Input
          id="add-player-profile-id"
          type="number"
          inputMode="numeric"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          placeholder="aoe2 profile_id"
          min={1}
          required
        />
        <Button type="submit" disabled={mutation.isPending || !profileId}>
          {mutation.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  )
}

async function surfaceError(error: unknown) {
  const normalized = await parseApiError(error)
  toast.error(getUserMessage(normalized), {
    description: normalized.requestId
      ? `Reference: ${normalized.requestId}`
      : undefined,
  })
}
