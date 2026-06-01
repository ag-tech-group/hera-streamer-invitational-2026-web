import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  getListPlayersV1TournamentsTournamentSlugPlayersGetQueryKey,
  useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost,
  useListPlayersV1TournamentsTournamentSlugPlayersGet,
  useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersLookupDelete,
  useUpdateRosterPlayerV1TournamentsTournamentSlugPlayersLookupPatch,
} from "@/api/generated/hooks/players/players"
import type { PlayerRead } from "@/api/generated/types"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CountryCombobox } from "@/components/country-combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { presentationDisplayName } from "@/lib/presentation"
import { isHttpUrl } from "@/lib/url"

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

  // Narrow the generated 200|422 union (see `owners-section.tsx`) and sort
  // alphabetically by the visible name (display-name override, else the ladder
  // alias) rather than the API's add-order, so the roster is scannable.
  // Case-insensitive; `localeCompare` keeps it stable and locale-aware. Keyed
  // on `query.data` so the array identity is stable across renders.
  const players: PlayerRead[] = useMemo(() => {
    if (query.data?.status !== 200) return []
    return [...query.data.data.items].sort((a, b) =>
      (presentationDisplayName(a.presentation) ?? a.alias).localeCompare(
        presentationDisplayName(b.presentation) ?? b.alias,
        undefined,
        { sensitivity: "base" }
      )
    )
  }, [query.data])

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
        <PlayerRow key={playerLookup(player)} player={player} />
      ))}
    </ul>
  )
}

function PlayerRow({ player }: { player: PlayerRead }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [editing, setEditing] = useState(false)
  const isPlaceholder = player.profile_id === null

  // Lead with the host-set Display name (the presentation override) — the same
  // name viewers see on the public standings, where `displayName ?? alias`
  // wins (#152). The line below spells out the *linked ladder account* (the
  // relic identity we actually poll) so an admin can catch a mis-link: a
  // profile_id pasted from the aoe2insights page URL (its site id) instead of
  // the relic "Game Id" resolves to an unrelated account, and that shows up
  // here straight away.
  const overrideName = presentationDisplayName(player.presentation)
  const visibleName = overrideName ?? player.alias
  // Surface the ladder alias only when an override is hiding it — without an
  // override the title already *is* the alias, so a wrong link is visible there
  // and repeating it would just be noise.
  const aliasMasked =
    overrideName !== undefined && overrideName !== player.alias
  const linkedAccount: string[] = []
  if (!isPlaceholder) {
    if (aliasMasked) linkedAccount.push(player.alias)
    linkedAccount.push(String(player.profile_id))
    if (player.country) linkedAccount.push(player.country)
  }
  // A polled identity with no rating row hasn't placed on the tracked ladder
  // yet — a brand-new account, or (per the mis-link above) a 0-game stranger.
  // `ratings` is populated for polled rows; guard on the array so an absent
  // field never false-flags a rated player as unrated.
  const notYetRated =
    !isPlaceholder &&
    Array.isArray(player.ratings) &&
    player.ratings.length === 0

  const mutation =
    useRemoveRosterPlayerV1TournamentsTournamentSlugPlayersLookupDelete({
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
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{visibleName}</span>
          {!isPlaceholder && (
            <span className="text-muted-foreground font-mono text-xs">
              {t("admin.players.linkedAccount")}: {linkedAccount.join(" · ")}
            </span>
          )}
          {notYetRated && (
            <span className="text-muted-foreground text-xs">
              {t("admin.players.notYetRated")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((open) => !open)}
            aria-label={t("admin.players.editAria", { name: visibleName })}
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
                  name: visibleName,
                })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            }
            title={t("admin.players.removeTitle", { name: visibleName })}
            description={t("admin.players.removeDescription")}
            confirmLabel={t("admin.players.removeConfirm")}
            destructive
            onConfirm={() =>
              mutation.mutate({
                tournamentSlug: activeTournament.apiTournamentSlug,
                lookup: playerLookup(player),
              })
            }
          />
        </div>
      </div>
      {editing && (
        <PresentationForm
          lookup={playerLookup(player)}
          alias={player.alias}
          profileId={player.profile_id}
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
 * managed keys (`displayName`, `flag`, `streamUrls`, `bio`), and write back.
 * Any *other* keys the bag carries survive untouched, so a later editor
 * extension can land without coordinating with this one.
 *
 * URLs are validated client-side — the API dropped server-side URL checks
 * — but only enough to block obvious garbage (must parse as http/https URL).
 * The bag is size-capped at 8 KB on the API, which is far past what these
 * three fields can reach in practice.
 */
function PresentationForm({
  lookup,
  alias,
  profileId,
  presentation,
  onDone,
}: {
  /**
   * Polymorphic lookup the API's `/players/{lookup}` URL family uses —
   * `profile_id` (numeric string) for polled rows, `alias` for placeholder
   * rows. See `playerLookup` for the derivation.
   */
  lookup: string
  alias: string
  /**
   * The row's polled identity, or `null` for a placeholder. When null the
   * form surfaces an editable Profile ID field — filling it promotes the
   * placeholder in the same PATCH. A polled row's identity is immutable, so
   * the field is omitted there.
   */
  profileId: number | null
  presentation: Record<string, unknown>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const isPlaceholder = profileId === null
  const [form, setForm] = useState<PresentationFormState>(() =>
    toPresentationFormState(presentation)
  )
  // Promotion is just another edit field: a placeholder's Profile ID starts
  // empty and, once filled, rides the same PATCH that saves the overrides.
  const [profileIdInput, setProfileIdInput] = useState(
    profileId !== null ? String(profileId) : ""
  )

  const mutation =
    useUpdateRosterPlayerV1TournamentsTournamentSlugPlayersLookupPatch({
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
    (url) => url.trim().length > 0 && !isHttpUrl(url)
  )

  // A profile_id is optional (a placeholder can be edited without promoting),
  // but once one is typed it must be a positive integer before save is allowed.
  const promotedId = Number(profileIdInput)
  const wantsPromote = isPlaceholder && profileIdInput.trim().length > 0
  const invalidProfileId =
    wantsPromote && !(Number.isInteger(promotedId) && promotedId > 0)

  // The profile URL is optional, but if set must parse as an http(s) URL —
  // same guard as the stream links, since the player name's href comes
  // straight from it.
  const invalidProfileUrl =
    form.profileUrl.trim().length > 0 && !isHttpUrl(form.profileUrl)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      lookup,
      data: {
        presentation: toPresentationUpdate(presentation, form),
        // Only a placeholder promotes; the API rejects changing a polled
        // row's profile_id, so it's never sent for one.
        ...(wantsPromote && !invalidProfileId
          ? { profile_id: promotedId }
          : {}),
      },
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
      {isPlaceholder && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`presentation-profile-id-${lookup}`}>
            {t("admin.players.presentation.profileId")}
          </Label>
          <Input
            id={`presentation-profile-id-${lookup}`}
            type="number"
            inputMode="numeric"
            value={profileIdInput}
            onChange={(event) => setProfileIdInput(event.target.value)}
            placeholder={t("admin.players.presentation.profileIdPlaceholder")}
            min={1}
            aria-invalid={invalidProfileId}
          />
          <ProfileIdHint />
        </div>
      )}
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {t("admin.players.presentation.title")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`presentation-name-${lookup}`}>
            {t("admin.players.presentation.displayName")}
          </Label>
          <Input
            id={`presentation-name-${lookup}`}
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
          <Label htmlFor={`presentation-flag-${lookup}`}>
            {t("admin.players.presentation.flag")}
          </Label>
          <CountryCombobox
            id={`presentation-flag-${lookup}`}
            value={form.flag}
            onChange={(flag) => setForm({ ...form, flag })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("admin.players.presentation.streamUrls")}</Label>
        {form.streamUrls.map((url, index) => {
          const invalid = url.trim().length > 0 && !isHttpUrl(url)
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`presentation-bio-${lookup}`}>
          {t("admin.players.presentation.bio")}
        </Label>
        <Textarea
          id={`presentation-bio-${lookup}`}
          value={form.bio}
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
          placeholder={t("admin.players.presentation.bioPlaceholder")}
          rows={3}
          // The whole presentation bag is capped at 8 KB on the API; 500
          // chars keeps the blurb broadcast-length with ample room left for
          // the name / flag / stream fields alongside it.
          maxLength={500}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`presentation-profile-url-${lookup}`}>
          {t("admin.players.presentation.profileUrl")}
        </Label>
        <Input
          id={`presentation-profile-url-${lookup}`}
          type="url"
          value={form.profileUrl}
          onChange={(event) =>
            setForm({ ...form, profileUrl: event.target.value })
          }
          placeholder={t("admin.players.presentation.profileUrlPlaceholder")}
          aria-invalid={invalidProfileUrl}
        />
        {invalidProfileUrl ? (
          <p className="text-destructive text-xs">
            {t("admin.players.presentation.invalidUrl")}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("admin.players.presentation.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            hasInvalidUrl ||
            invalidProfileId ||
            invalidProfileUrl
          }
        >
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
  bio: string
  profileUrl: string
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
    bio: typeof presentation.bio === "string" ? presentation.bio : "",
    profileUrl:
      typeof presentation.profileUrl === "string"
        ? presentation.profileUrl
        : "",
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
  const bio = form.bio.trim()
  if (bio) updated.bio = bio
  else delete updated.bio
  const profileUrl = form.profileUrl.trim()
  if (profileUrl) updated.profileUrl = profileUrl
  else delete updated.profileUrl
  return updated
}

/**
 * Polymorphic lookup string for the `/players/{lookup}` URL family
 * (#185). Polled rows use the `profile_id` (a numeric string); placeholder
 * rows use the host-given `alias`. The API rejects integer-looking names
 * on POST so the routing key stays unambiguous: a numeric path segment
 * is always a `profile_id`, a non-numeric segment is always a name.
 */
function playerLookup(player: PlayerRead): string {
  return player.profile_id !== null
    ? player.profile_id.toString()
    : player.alias
}

/**
 * Add a roster entry — polled player or placeholder, one form (#198). A roster
 * member is one logical entity; whether it has a relic profile_id is just an
 * attribute, so adding is the same action either way. The single
 * `POST /v1/tournaments/{slug}/players` endpoint takes `profile_id` XOR `name`
 * (422 on both/neither, or a name that parses as an integer), so the form
 * dispatches on which fields are filled: a profile ID adds a polled identity
 * (with the typed name, if any, riding along as a `displayName` override); a
 * name alone adds a placeholder to promote later.
 */
export function AddPlayerForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [name, setName] = useState("")
  const [profileId, setProfileId] = useState("")

  const mutation = useAddRosterPlayerV1TournamentsTournamentSlugPlayersPost({
    request: {
      headers: { "Idempotency-Key": idempotencyKey.current },
    },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        setName("")
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

  const trimmedName = name.trim()
  const trimmedId = profileId.trim()
  const hasName = trimmedName.length > 0
  const hasId = trimmedId.length > 0
  const validId =
    hasId && Number.isInteger(Number(trimmedId)) && Number(trimmedId) > 0
  // A digits-only name with no profile ID would 422 — the API reserves integer
  // lookups for profile IDs — and almost always means an ID typed into the
  // wrong field. (A numeric name *with* an ID is fine: it rides along as a
  // displayName override, not a top-level `name`.)
  const numericNameBlocked = !hasId && hasName && /^\d+$/.test(trimmedName)

  const errorKey =
    hasId && !validId
      ? "admin.players.addErrorProfileId"
      : numericNameBlocked
        ? "admin.players.addErrorNumericName"
        : null
  // Need at least one of name / ID, a valid ID when one is given, and not a
  // digits-only placeholder name.
  const canSubmit = (hasId ? validId : hasName) && !numericNameBlocked

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    // `profile_id` XOR top-level `name`; a name alongside an ID becomes a
    // display override rather than a second identity key.
    const data = hasId
      ? {
          profile_id: Number(trimmedId),
          ...(hasName ? { presentation: { displayName: trimmedName } } : {}),
        }
      : { name: trimmedName }
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      data,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/60 flex flex-col gap-3 border-t pt-4"
    >
      <p className="text-sm font-medium">{t("admin.players.addLabel")}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-player-name">
          {t("admin.players.addNameLabel")}
        </Label>
        <Input
          id="add-player-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("admin.players.addNamePlaceholder")}
          aria-invalid={numericNameBlocked}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-player-profile-id">
          {t("admin.players.addProfileIdLabel")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="add-player-profile-id"
            type="number"
            inputMode="numeric"
            min={1}
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
            placeholder={t("admin.players.addProfileIdPlaceholder")}
            aria-invalid={hasId && !validId}
          />
          <Button type="submit" disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending
              ? t("admin.players.addingAction")
              : t("admin.players.addAction")}
          </Button>
        </div>
        <ProfileIdHint />
      </div>
      {errorKey ? (
        <p className="text-destructive text-xs">{t(errorKey)}</p>
      ) : null}
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
          strong: <strong className="font-semibold" />,
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
