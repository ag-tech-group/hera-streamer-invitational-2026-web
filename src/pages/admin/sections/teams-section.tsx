import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Shield, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useListPlayersV1TournamentsTournamentSlugPlayersGet } from "@/api/generated/hooks/players/players"
import { getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey } from "@/api/generated/hooks/tournaments/tournaments"
import {
  useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost,
  useClearTeamCaptainV1TournamentsTournamentSlugTeamsTeamIdCaptainDelete,
  useCreateTeamV1TournamentsTournamentSlugTeamsPost,
  useDeleteTeamV1TournamentsTournamentSlugTeamsTeamIdDelete,
  useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete,
  useSetTeamCaptainV1TournamentsTournamentSlugTeamsTeamIdCaptainPatch,
  useUpdateTeamV1TournamentsTournamentSlugTeamsTeamIdPatch,
} from "@/api/generated/hooks/teams/teams"
import type { PlayerRead } from "@/api/generated/types"

/**
 * Polled-only narrowing of `PlayerRead` (#185). The teams admin filters
 * out placeholder rows at the source because the API's team-member ops
 * still key off `profile_id`; downstream components type their roster
 * prop as `PolledPlayer[]` rather than `PlayerRead[]` so the non-null
 * guarantee propagates without per-site assertions.
 */
type PolledPlayer = PlayerRead & { profile_id: number }
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { presentationDisplayName } from "@/lib/presentation"
import {
  TEAM_COLOR_SLOTS,
  teamColorMap,
  type TeamColorSlot,
} from "@/lib/team-colors"
import { cn } from "@/lib/utils"
import type { TeamMember, TeamStandingsRow } from "@/types"

/**
 * Manage the active tournament's teams — list, create, edit, delete —
 * plus team member roster (add / remove by profile_id). The list is
 * sourced from `useTeamStandings` (same data the public Teams view
 * reads) so any admin write invalidates the standings cache and the
 * public view picks up the change on its next render.
 */
export function TeamsSection() {
  const { t } = useTranslation()
  const teams = useTeamStandings(true)
  const playersQuery = useListPlayersV1TournamentsTournamentSlugPlayersGet(
    activeTournament.apiTournamentSlug
  )

  // Sorted by teamId (≈ creation order) so the admin list stays put when a
  // roster edit changes a team's combined rating. The standings endpoint
  // returns teams rating-ranked, so without this the list reshuffles on every
  // add/remove — confusing while managing rosters. Also memoised so the `[]`
  // fallback keeps a stable identity for the `playerTeamMap` useMemo below.
  const rows = useMemo(
    () => [...(teams.data?.rows ?? [])].sort((a, b) => a.teamId - b.teamId),
    [teams.data?.rows]
  )

  // Colour each admin card by team identity, reusing the public Teams view's
  // creation-order `teamColorMap` (#231) — built from the full id set and keyed
  // by id, so a team's colour here matches its panel, standings chip, and stats
  // bar everywhere else. `rows` is already teamId-sorted, the order the map
  // assigns slots from.
  const colorByTeamId = useMemo(
    () => teamColorMap(rows.map((r) => r.teamId)),
    [rows]
  )

  // Teams require a polled `profile_id` to add a member (the API's team-
  // member rows still key off it, unchanged by the unified roster in
  // #185). Placeholders surface on the players-admin tab but can't be put
  // on teams until they're promoted, so filter them out at the source
  // here. The type predicate narrows `profile_id` to non-null for every
  // downstream consumer of `allPlayers`.
  const allPlayers: PolledPlayer[] = useMemo(() => {
    if (playersQuery.data?.status !== 200) return []
    return (
      playersQuery.data.data.items
        .filter((p): p is PolledPlayer => p.profile_id !== null)
        // Alphabetical by visible name (display-name override, else alias) so the
        // add-member dropdown reads in name order, not API add-order. Case-
        // insensitive via localeCompare.
        .sort((a, b) =>
          (presentationDisplayName(a.presentation) ?? a.alias).localeCompare(
            presentationDisplayName(b.presentation) ?? b.alias,
            undefined,
            { sensitivity: "base" }
          )
        )
    )
  }, [playersQuery.data])

  // Map of profile_id → the team they're currently on (if any). Lets the
  // add-member select badge each option with its existing team and trigger
  // a move-confirm when a contested pick is submitted.
  const playerTeamMap = useMemo(() => {
    const map = new Map<number, { teamId: number; teamName: string }>()
    for (const team of rows) {
      for (const member of team.members) {
        map.set(member.profileId, {
          teamId: team.teamId,
          teamName: team.name,
        })
      }
    }
    return map
  }, [rows])

  // profile_id → host-set Display name override (when set), built from the same
  // roster the Players tab edits. Lets the member chips and add-member picker
  // show the friendly name viewers see, rather than the raw ladder alias the
  // team-standings endpoint returns (it carries no presentation bag).
  const displayNameByProfileId = useMemo(() => {
    const map: DisplayNameMap = new Map()
    for (const player of allPlayers) {
      const name = presentationDisplayName(player.presentation)
      if (name) map.set(player.profile_id, name)
    }
    return map
  }, [allPlayers])

  return (
    <div className="flex flex-col gap-4">
      <CreateTeamForm />
      {teams.isPending ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : teams.isError ? (
        <p className="text-destructive text-sm">{t("admin.teams.loadError")}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("admin.teams.noTeams")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((team) => (
            <TeamItem
              key={team.teamId}
              team={team}
              color={colorByTeamId.get(team.teamId) ?? TEAM_COLOR_SLOTS[0]}
              allPlayers={allPlayers}
              playerTeamMap={playerTeamMap}
              displayNameByProfileId={displayNameByProfileId}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

type PlayerTeamMap = Map<number, { teamId: number; teamName: string }>

/** profile_id → host-set Display name override (present only when one is set). */
type DisplayNameMap = Map<number, string>

function teamsQueryKey() {
  return getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey(
    activeTournament.apiTournamentSlug
  )
}

/** One team's full admin card: header (name/initials/edit/delete) + members + add-member form. */
function TeamItem({
  team,
  color,
  allPlayers,
  playerTeamMap,
  displayNameByProfileId,
}: {
  team: TeamStandingsRow
  color: TeamColorSlot
  allPlayers: PolledPlayer[]
  playerTeamMap: PlayerTeamMap
  displayNameByProfileId: DisplayNameMap
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)

  return (
    // `data-team-color` exposes the team's palette to descendants as the
    // generic `--team-color*` vars (see index.css), the same mechanism the
    // public Teams view uses — so the accent rail and initials chip tint to the
    // team's colour without per-team class names. A left rail (vs the public
    // card's top stripe) suits the dense admin list and echoes the stats
    // summary cards; the rail also marks identity while the header is in edit
    // mode and the initials chip is hidden.
    <li
      data-team-color={color}
      className="border-border/60 relative flex flex-col gap-3 overflow-hidden rounded-md border p-3 pl-4"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: "var(--team-color)" }}
      />
      {editing ? (
        <EditTeamForm team={team} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="ring-border rounded px-2 py-0.5 font-mono text-xs ring-1 ring-inset"
              style={{
                background: "var(--team-color-bg)",
                color: "var(--team-color-strong)",
              }}
            >
              {team.initials}
            </span>
            <span className="text-sm font-medium">{team.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              aria-label={t("admin.teams.editAria", { name: team.name })}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <DeleteTeamButton team={team} />
          </div>
        </div>
      )}

      <MembersBlock
        teamId={team.teamId}
        members={team.members}
        allPlayers={allPlayers}
        playerTeamMap={playerTeamMap}
        displayNameByProfileId={displayNameByProfileId}
      />
    </li>
  )
}

function EditTeamForm({
  team,
  onDone,
}: {
  team: TeamStandingsRow
  onDone: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [name, setName] = useState(team.name)
  const [initials, setInitials] = useState(team.initials)

  const mutation = useUpdateTeamV1TournamentsTournamentSlugTeamsTeamIdPatch({
    request: { headers: { "Idempotency-Key": idempotencyKey.current } },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        toast.success(t("admin.teams.updateSuccess"))
        onDone()
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
          teamId: team.teamId,
          data: { name, initials },
        })
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <Input
          value={initials}
          onChange={(event) => setInitials(event.target.value)}
          maxLength={8}
          required
          className="w-24"
          aria-label={t("admin.teams.initialsPlaceholder")}
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          required
          aria-label={t("admin.teams.namePlaceholder")}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {t("admin.teams.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? t("admin.teams.saving") : t("admin.teams.save")}
        </Button>
      </div>
    </form>
  )
}

function DeleteTeamButton({ team }: { team: TeamStandingsRow }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()

  const mutation = useDeleteTeamV1TournamentsTournamentSlugTeamsTeamIdDelete({
    request: { headers: { "Idempotency-Key": idempotencyKey.current } },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        toast.success(t("admin.teams.deleteSuccess"))
      },
      onError: idempotencyKey.resetOnReusedKey,
    },
  })

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          aria-label={t("admin.teams.deleteAria", { name: team.name })}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
      title={t("admin.teams.deleteTitle", { name: team.name })}
      description={t("admin.teams.deleteDescription")}
      confirmLabel={t("admin.teams.deleteConfirm")}
      destructive
      onConfirm={() =>
        mutation.mutate({
          tournamentSlug: activeTournament.apiTournamentSlug,
          teamId: team.teamId,
        })
      }
    />
  )
}

function MembersBlock({
  teamId,
  members,
  allPlayers,
  playerTeamMap,
  displayNameByProfileId,
}: {
  teamId: number
  members: TeamMember[]
  allPlayers: PolledPlayer[]
  playerTeamMap: PlayerTeamMap
  displayNameByProfileId: DisplayNameMap
}) {
  const { t } = useTranslation()
  return (
    <div className="border-border/40 flex flex-col gap-2 border-t pt-3">
      {members.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("admin.teams.noMembers")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <MemberChip
              key={member.profileId}
              teamId={teamId}
              member={member}
              displayNameByProfileId={displayNameByProfileId}
            />
          ))}
        </ul>
      )}
      <AddMemberForm
        teamId={teamId}
        members={members}
        allPlayers={allPlayers}
        playerTeamMap={playerTeamMap}
        displayNameByProfileId={displayNameByProfileId}
      />
    </div>
  )
}

function MemberChip({
  teamId,
  member,
  displayNameByProfileId,
}: {
  teamId: number
  member: TeamMember
  displayNameByProfileId: DisplayNameMap
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const captainIdempotencyKey = useIdempotencyKey()
  const name = displayNameByProfileId.get(member.profileId) ?? member.alias

  const invalidateTeams = () =>
    void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })

  const mutation =
    useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete(
      {
        request: { headers: { "Idempotency-Key": idempotencyKey.current } },
        mutation: {
          onSuccess: () => {
            idempotencyKey.reset()
            invalidateTeams()
          },
          onError: idempotencyKey.resetOnReusedKey,
        },
      }
    )

  // Set / clear captain (#235). The toggle picks the route by the member's
  // current captain state; both are 204 no-ops if already in the target state,
  // so a double-click can't error. On success the team-standings cache is
  // invalidated so the badge updates here and on the public teams view.
  const setCaptain =
    useSetTeamCaptainV1TournamentsTournamentSlugTeamsTeamIdCaptainPatch({
      request: {
        headers: { "Idempotency-Key": captainIdempotencyKey.current },
      },
      mutation: {
        onSuccess: () => {
          captainIdempotencyKey.reset()
          invalidateTeams()
          toast.success(t("admin.teams.captainSetSuccess", { name }))
        },
        onError: captainIdempotencyKey.resetOnReusedKey,
      },
    })
  const clearCaptain =
    useClearTeamCaptainV1TournamentsTournamentSlugTeamsTeamIdCaptainDelete({
      request: {
        headers: { "Idempotency-Key": captainIdempotencyKey.current },
      },
      mutation: {
        onSuccess: () => {
          captainIdempotencyKey.reset()
          invalidateTeams()
          toast.success(t("admin.teams.captainClearSuccess", { name }))
        },
        onError: captainIdempotencyKey.resetOnReusedKey,
      },
    })

  const captainPending = setCaptain.isPending || clearCaptain.isPending
  const toggleCaptain = () => {
    if (member.isCaptain) {
      clearCaptain.mutate({
        tournamentSlug: activeTournament.apiTournamentSlug,
        teamId,
      })
    } else {
      setCaptain.mutate({
        tournamentSlug: activeTournament.apiTournamentSlug,
        teamId,
        data: { profile_id: member.profileId },
      })
    }
  }

  return (
    <li
      className={cn(
        "bg-muted/40 inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-xs",
        member.isCaptain && "ring-brand/40 ring-1 ring-inset"
      )}
    >
      <span className="font-medium">{name}</span>
      {/* Captain toggle: filled brand shield when captain, muted outline when
          not. Tapping sets or clears (idempotent on the API). */}
      <button
        type="button"
        disabled={captainPending}
        onClick={toggleCaptain}
        aria-pressed={member.isCaptain}
        aria-label={t(
          member.isCaptain
            ? "admin.teams.clearCaptainAria"
            : "admin.teams.setCaptainAria",
          { name }
        )}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full transition-colors disabled:opacity-50",
          member.isCaptain
            ? "text-brand hover:text-brand/70"
            : "text-muted-foreground hover:text-brand"
        )}
        title={t(
          member.isCaptain
            ? "admin.teams.clearCaptain"
            : "admin.teams.setCaptain"
        )}
      >
        <Shield
          className="size-3.5"
          fill={member.isCaptain ? "currentColor" : "none"}
          aria-hidden
        />
      </button>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            disabled={mutation.isPending}
            className="hover:bg-destructive/20 hover:text-destructive group inline-flex size-5 items-center justify-center rounded-full transition-colors disabled:opacity-50"
            aria-label={t("admin.teams.removeMemberAria", { name })}
          >
            <Trash2
              className="size-3 opacity-50 group-hover:opacity-100"
              aria-hidden
            />
          </button>
        }
        title={t("admin.teams.removeMemberTitle", { name })}
        description={t("admin.teams.removeMemberDescription")}
        confirmLabel={t("admin.teams.removeMemberConfirm")}
        destructive
        onConfirm={() =>
          mutation.mutate({
            tournamentSlug: activeTournament.apiTournamentSlug,
            teamId,
            profileId: member.profileId,
          })
        }
      />
    </li>
  )
}

/**
 * Add-member control: a Select populated from the tournament's player
 * roster (filtered to exclude players who are already on *this* team).
 * Each option badges its existing team if the player is on one. When
 * the chosen player is on another team, an AlertDialog appears asking
 * whether to move them; on confirm the picker explicitly removes the
 * player from the source team before adding to the destination. The
 * add-member API doesn't enforce single-team-per-tournament on its own,
 * so without this DELETE-then-POST the move would silently double-add.
 *
 * Not atomic — if the DELETE succeeds but the POST fails, the player
 * lands on neither team. The global mutation-error toast surfaces the
 * failure and the admin can re-add. A transaction-safe fix would live
 * on the backend (UNIQUE constraint + auto-move on add); revisiting
 * that is tracked separately.
 *
 * The free-form profile_id input was the previous shape; revisiting
 * that approach is tracked in #83 as the side-by-side drag-and-drop
 * follow-up.
 */
function AddMemberForm({
  teamId,
  members,
  allPlayers,
  playerTeamMap,
  displayNameByProfileId,
}: {
  teamId: number
  members: TeamMember[]
  allPlayers: PolledPlayer[]
  playerTeamMap: PlayerTeamMap
  displayNameByProfileId: DisplayNameMap
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addIdempotencyKey = useIdempotencyKey()
  const removeIdempotencyKey = useIdempotencyKey()
  const [selectedId, setSelectedId] = useState<string>("")
  const [pendingMove, setPendingMove] = useState<{
    profileId: number
    name: string
    fromTeamId: number
    fromTeamName: string
  } | null>(null)

  const addMutation =
    useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost({
      request: { headers: { "Idempotency-Key": addIdempotencyKey.current } },
      mutation: {
        onSuccess: () => {
          addIdempotencyKey.reset()
          setSelectedId("")
          setPendingMove(null)
          void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        },
        onError: addIdempotencyKey.resetOnReusedKey,
      },
    })

  // Used only for the DELETE leg of a move. Not invalidating on its own
  // onSuccess: the chained POST's onSuccess does the single invalidation
  // for the whole move, so the UI sees the consistent post-move state in
  // one render rather than briefly seeing the player on neither team.
  const removeMutation =
    useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete(
      {
        request: {
          headers: { "Idempotency-Key": removeIdempotencyKey.current },
        },
        mutation: { onError: removeIdempotencyKey.resetOnReusedKey },
      }
    )

  // Members already on *this* team are excluded from the dropdown so
  // the user can't pick a no-op. Players on *other* teams stay in the
  // list with their current team noted; picking them triggers the
  // move-confirm dialog.
  const memberIds = useMemo(
    () => new Set(members.map((m) => m.profileId)),
    [members]
  )
  const options = allPlayers.filter((p) => !memberIds.has(p.profile_id))

  const submitAdd = (profileId: number) => {
    addMutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      teamId,
      data: { profile_id: profileId },
    })
  }

  const submitMove = (move: { profileId: number; fromTeamId: number }) => {
    removeMutation.mutate(
      {
        tournamentSlug: activeTournament.apiTournamentSlug,
        teamId: move.fromTeamId,
        profileId: move.profileId,
      },
      {
        onSuccess: () => {
          removeIdempotencyKey.reset()
          submitAdd(move.profileId)
        },
      }
    )
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    const profileId = Number(selectedId)
    const existing = playerTeamMap.get(profileId)
    if (existing && existing.teamId !== teamId) {
      const player = allPlayers.find((p) => p.profile_id === profileId)
      setPendingMove({
        profileId,
        name:
          displayNameByProfileId.get(profileId) ??
          player?.alias ??
          String(profileId),
        fromTeamId: existing.teamId,
        fromTeamName: existing.teamName,
      })
      return
    }
    submitAdd(profileId)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label
          htmlFor={`add-member-${teamId}`}
          className="text-muted-foreground text-xs"
        >
          {t("admin.teams.addMember")}
        </Label>
        <div className="flex gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger
              id={`add-member-${teamId}`}
              size="sm"
              className="flex-1"
              disabled={options.length === 0}
            >
              <SelectValue
                placeholder={
                  options.length === 0
                    ? t("admin.teams.addMemberNone")
                    : t("admin.teams.addMemberPlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((player) => {
                const existing = playerTeamMap.get(player.profile_id)
                const optionName =
                  displayNameByProfileId.get(player.profile_id) ?? player.alias
                return (
                  <SelectItem
                    key={player.profile_id}
                    value={String(player.profile_id)}
                  >
                    <span>{optionName}</span>
                    {existing ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {t("admin.teams.memberOnTeam", {
                          name: existing.teamName,
                        })}
                      </span>
                    ) : null}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            disabled={
              addMutation.isPending || removeMutation.isPending || !selectedId
            }
          >
            {addMutation.isPending || removeMutation.isPending
              ? t("admin.teams.addMemberAdding")
              : t("admin.teams.addMemberAction")}
          </Button>
        </div>
      </form>

      {/*
       * Conditional confirm: only opens when the picked player is
       * already on another team. The free `ConfirmDialog` helper is
       * trigger-based; for an imperatively-controlled dialog like this
       * the `<AlertDialog open={...}>` shape is cleaner.
       */}
      <AlertDialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.teams.moveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove
                ? t("admin.teams.moveDescription", {
                    name: pendingMove.name,
                    from: pendingMove.fromTeamName,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove)
                  submitMove({
                    profileId: pendingMove.profileId,
                    fromTeamId: pendingMove.fromTeamId,
                  })
              }}
            >
              {t("admin.teams.moveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CreateTeamForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [name, setName] = useState("")
  const [initials, setInitials] = useState("")

  const mutation = useCreateTeamV1TournamentsTournamentSlugTeamsPost({
    request: { headers: { "Idempotency-Key": idempotencyKey.current } },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        setName("")
        setInitials("")
        void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        toast.success(t("admin.teams.createSuccess"))
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
          data: { name, initials },
        })
      }}
      className="border-border/60 flex flex-col gap-2 border-b pb-4"
    >
      <Label>{t("admin.teams.createLabel")}</Label>
      {/*
       * Stack the inputs + submit vertically on small viewports — the
       * initials, team name, and submit triplet can't share one row
       * without crowding below ~`sm:`. Side-by-side on `sm:` and up.
       */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={initials}
          onChange={(event) => setInitials(event.target.value)}
          placeholder={t("admin.teams.initialsPlaceholder")}
          maxLength={8}
          required
          className="sm:w-24"
          aria-label={t("admin.teams.initialsPlaceholder")}
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("admin.teams.namePlaceholder")}
          maxLength={200}
          required
          aria-label={t("admin.teams.namePlaceholder")}
        />
        <Button
          type="submit"
          disabled={mutation.isPending || !name || !initials}
        >
          {mutation.isPending
            ? t("admin.teams.creatingAction")
            : t("admin.teams.createAction")}
        </Button>
      </div>
    </form>
  )
}
