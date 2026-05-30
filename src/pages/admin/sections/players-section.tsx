import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey,
  useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost,
  useListPlayersV1TournamentsTournamentSlugPlayersGet,
  useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdDelete,
  useUpdateRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdPatch,
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
  const [editing, setEditing] = useState(false)

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
    <li className="bg-muted/30 flex flex-col gap-3 rounded-md px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{player.alias}</span>
          <span className="text-muted-foreground font-mono text-xs">
            profile_id {player.profile_id}
            {player.country ? ` · ${player.country}` : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((open) => !open)}
            aria-label={t("admin.players.editAria", { name: player.alias })}
            aria-expanded={editing}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mutation.isPending}
                aria-label={t("admin.players.removeAria", {
                  name: player.alias,
                })}
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
        </div>
      </div>
      {editing && (
        <PresentationForm
          profileId={player.profile_id}
          alias={player.alias}
          presentation={
            (player.presentation as Record<string, unknown> | undefined) ?? {}
          }
          onDone={() => setEditing(false)}
        />
      )}
    </li>
  )
}

/**
 * Inline editor for one roster member's `presentation` bag (#152). The API
 * treats the bag as opaque and replaces it wholesale on PATCH, so this form
 * does a **read-modify-write**: spread the existing object, overlay the
 * managed keys (`displayName`, `flag`, `streamUrls`), and write back. Any
 * other keys the bag carries (e.g. a future `bio`) survive untouched, so a
 * later editor extension can land without coordinating with this one.
 *
 * URLs are validated client-side — the API dropped server-side URL checks
 * — but only enough to block obvious garbage (must parse as http/https URL).
 * The bag is size-capped at 8 KB on the API, which is far past what these
 * three fields can reach in practice.
 */
function PresentationForm({
  profileId,
  alias,
  presentation,
  onDone,
}: {
  profileId: number
  alias: string
  presentation: Record<string, unknown>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [form, setForm] = useState<PresentationFormState>(() =>
    toPresentationFormState(presentation)
  )

  const mutation =
    useUpdateRosterPlayerV1TournamentsTournamentSlugPlayersProfileIdPatch({
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
          toast.success(t("admin.players.presentation.saveSuccess"))
          onDone()
        },
        onError: idempotencyKey.resetOnReusedKey,
      },
    })

  // Disable save when any non-empty URL field doesn't parse — preserves
  // empty rows (used to add a slot) without false-flagging them.
  const hasInvalidUrl = form.streamUrls.some(
    (url) => url.trim().length > 0 && !isValidStreamUrl(url)
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      profileId,
      data: { presentation: toPresentationUpdate(presentation, form) },
    })
  }

  const updateStreamUrl = (index: number, value: string) => {
    setForm({
      ...form,
      streamUrls: form.streamUrls.map((u, i) => (i === index ? value : u)),
    })
  }

  const removeStreamUrl = (index: number) => {
    setForm({
      ...form,
      streamUrls: form.streamUrls.filter((_, i) => i !== index),
    })
  }

  const addStreamUrl = () => {
    setForm({ ...form, streamUrls: [...form.streamUrls, ""] })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/60 flex flex-col gap-3 border-t pt-3"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {t("admin.players.presentation.title")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`presentation-name-${profileId}`}>
            {t("admin.players.presentation.displayName")}
          </Label>
          <Input
            id={`presentation-name-${profileId}`}
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
            placeholder={t("admin.players.presentation.displayNamePlaceholder")}
            // Clipped to the API's 8 KB bag — sane fallback for a display
            // handle, well past any reasonable streamer name.
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`presentation-flag-${profileId}`}>
            {t("admin.players.presentation.flag")}
          </Label>
          <Input
            id={`presentation-flag-${profileId}`}
            value={form.flag}
            onChange={(event) => setForm({ ...form, flag: event.target.value })}
            placeholder={t("admin.players.presentation.flagPlaceholder")}
            className="w-20 text-center text-base"
            // A country emoji is two regional-indicator codepoints (~8 UTF-16
            // units); 16 leaves headroom for a flag-with-modifier (e.g.
            // England's flag uses a tag sequence) without inviting essays.
            maxLength={16}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("admin.players.presentation.streamUrls")}</Label>
        {form.streamUrls.map((url, index) => {
          const invalid = url.trim().length > 0 && !isValidStreamUrl(url)
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(event) =>
                    updateStreamUrl(index, event.target.value)
                  }
                  placeholder={t(
                    "admin.players.presentation.streamUrlPlaceholder"
                  )}
                  aria-invalid={invalid}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeStreamUrl(index)}
                  aria-label={t(
                    "admin.players.presentation.removeStreamUrlAria",
                    { name: alias }
                  )}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              {invalid && (
                <p className="text-destructive text-xs">
                  {t("admin.players.presentation.invalidUrl")}
                </p>
              )}
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStreamUrl}
          className="self-start"
        >
          <Plus className="size-4" aria-hidden />
          {t("admin.players.presentation.addStreamUrl")}
        </Button>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("admin.players.presentation.cancel")}
        </Button>
        <Button type="submit" disabled={mutation.isPending || hasInvalidUrl}>
          {mutation.isPending
            ? t("admin.players.presentation.saving")
            : t("admin.players.presentation.save")}
        </Button>
      </div>
    </form>
  )
}

interface PresentationFormState {
  displayName: string
  flag: string
  streamUrls: string[]
}

function toPresentationFormState(
  presentation: Record<string, unknown>
): PresentationFormState {
  return {
    displayName:
      typeof presentation.displayName === "string"
        ? presentation.displayName
        : "",
    flag: typeof presentation.flag === "string" ? presentation.flag : "",
    streamUrls: Array.isArray(presentation.streamUrls)
      ? presentation.streamUrls.filter(
          (u): u is string => typeof u === "string"
        )
      : [],
  }
}

/**
 * Read-modify-write helper: spread the existing presentation (so unmanaged
 * keys survive) then overlay the form's managed fields. Empty strings or
 * empty lists drop the key entirely rather than writing an empty value —
 * the standings UI treats both "key absent" and "key empty" as "no
 * override," but absent reads cleaner upstream.
 */
function toPresentationUpdate(
  existing: Record<string, unknown>,
  form: PresentationFormState
): Record<string, unknown> {
  const updated: Record<string, unknown> = { ...existing }
  const displayName = form.displayName.trim()
  if (displayName) updated.displayName = displayName
  else delete updated.displayName
  const flag = form.flag.trim()
  if (flag) updated.flag = flag
  else delete updated.flag
  const streamUrls = form.streamUrls
    .map((u) => u.trim())
    .filter((u): u is string => u.length > 0)
  if (streamUrls.length > 0) updated.streamUrls = streamUrls
  else delete updated.streamUrls
  return updated
}

/**
 * Lightweight URL guard for stream channel links. Requires `http(s)`
 * specifically — other protocols (`javascript:`, `data:`, etc.) are
 * rejected so a bag value can't smuggle in an XSS vector when rendered as
 * an anchor href later. The standings UI doesn't run the URL through any
 * parser before opening it.
 */
function isValidStreamUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
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
