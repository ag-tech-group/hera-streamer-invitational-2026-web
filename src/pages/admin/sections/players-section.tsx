import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey,
  useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost,
  useListPlayersV1TournamentsTournamentSlugPlayersGet,
  useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdDelete,
} from "@/api/generated/hooks/players/players"
import type { PlayerRead } from "@/api/generated/types"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"

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
  const { t } = useTranslation()
  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
    )
  }
  if (error) {
    return (
      <p className="text-destructive text-sm">{t("admin.players.loadError")}</p>
    )
  }
  if (players.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("admin.players.noPlayers")}
      </p>
    )
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
  const { t } = useTranslation()
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
          toast.success(t("admin.players.removeSuccess"))
        },
        onError: idempotencyKey.resetOnReusedKey,
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
      <ConfirmDialog
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            aria-label={t("admin.players.removeAria", { name: player.alias })}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        }
        title={t("admin.players.removeTitle", { name: player.alias })}
        description={t("admin.players.removeDescription")}
        confirmLabel={t("admin.players.removeConfirm")}
        destructive
        onConfirm={() =>
          mutation.mutate({
            tournamentSlug: activeTournament.apiTournamentSlug,
            profileId: player.profile_id,
          })
        }
      />
    </li>
  )
}

function AddPlayerForm() {
  const { t } = useTranslation()
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
        toast.success(t("admin.players.addSuccess"))
      },
      onError: idempotencyKey.resetOnReusedKey,
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
      <Label htmlFor="add-player-profile-id">
        {t("admin.players.addLabel")}
      </Label>
      <div className="flex gap-2">
        <Input
          id="add-player-profile-id"
          type="number"
          inputMode="numeric"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          placeholder={t("admin.players.addPlaceholder")}
          min={1}
          required
        />
        <Button type="submit" disabled={mutation.isPending || !profileId}>
          {mutation.isPending
            ? t("admin.players.addingAction")
            : t("admin.players.addAction")}
        </Button>
      </div>
      <ProfileIdHint />
    </form>
  )
}

/**
 * One-liner that points admins at where to find a profile_id. The number
 * is the path segment in an aoe2insights player URL — most hosts already
 * use that site to look up player history.
 */
export function ProfileIdHint() {
  return (
    <p className="text-muted-foreground text-xs">
      <Trans
        i18nKey="admin.players.profileHint"
        components={{
          code: <code className="font-mono" />,
          link: (
            <a
              href="https://www.aoe2insights.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2"
            />
          ),
        }}
      />
    </p>
  )
}
