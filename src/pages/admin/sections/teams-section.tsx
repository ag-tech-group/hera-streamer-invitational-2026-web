import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useListPlayersV1TournamentsTournamentSlugPlayersGet } from "@/api/generated/hooks/players/players"
import { getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey } from "@/api/generated/hooks/tournaments/tournaments"
import {
  useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost,
  useCreateTeamV1TournamentsTournamentSlugTeamsPost,
  useDeleteTeamV1TournamentsTournamentSlugTeamsTeamIdDelete,
  useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete,
  useUpdateTeamV1TournamentsTournamentSlugTeamsTeamIdPatch,
} from "@/api/generated/hooks/teams/teams"
import type { PlayerRead } from "@/api/generated/types"
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
import type { TeamMember, TeamStandingsRow } from "@/types"

/**
 * Manage the active tournament's teams — list, create, edit, delete —
 * plus team member roster (add / remove by profile_id). The list is
 * sourced from `useTeamStandings` (same data the public Teams view
 * reads) so any admin write invalidates the standings cache and the
 * public view picks up the change on its next render.
 */
export function TeamsSection() {
  const teams = useTeamStandings(true)
  const playersQuery = useListPlayersV1TournamentsTournamentSlugPlayersGet(
    activeTournament.apiTournamentSlug
  )

  // Memoised so the `[]` fallback doesn't change identity on every render
  // when there's no data — keeps `playerTeamMap`'s `useMemo` stable too.
  const rows = useMemo(() => teams.data?.rows ?? [], [teams.data?.rows])

  const allPlayers: PlayerRead[] =
    playersQuery.data?.status === 200 ? playersQuery.data.data.items : []

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

  return (
    <div className="flex flex-col gap-4">
      {teams.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : teams.isError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load teams.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teams yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((team) => (
            <TeamItem
              key={team.teamId}
              team={team}
              allPlayers={allPlayers}
              playerTeamMap={playerTeamMap}
            />
          ))}
        </ul>
      )}
      <CreateTeamForm />
    </div>
  )
}

type PlayerTeamMap = Map<number, { teamId: number; teamName: string }>

function teamsQueryKey() {
  return getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey(
    activeTournament.apiTournamentSlug
  )
}

/** One team's full admin card: header (name/initials/edit/delete) + members + add-member form. */
function TeamItem({
  team,
  allPlayers,
  playerTeamMap,
}: {
  team: TeamStandingsRow
  allPlayers: PlayerRead[]
  playerTeamMap: PlayerTeamMap
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="border-border/60 flex flex-col gap-3 rounded-md border p-3">
      {editing ? (
        <EditTeamForm team={team} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs">
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
              aria-label={`Edit ${team.name}`}
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
        toast.success("Team updated.")
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
          aria-label="Initials"
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          required
          aria-label="Team name"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}

function DeleteTeamButton({ team }: { team: TeamStandingsRow }) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()

  const mutation = useDeleteTeamV1TournamentsTournamentSlugTeamsTeamIdDelete({
    request: { headers: { "Idempotency-Key": idempotencyKey.current } },
    mutation: {
      onSuccess: () => {
        idempotencyKey.reset()
        void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        toast.success("Team deleted.")
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
          aria-label={`Delete ${team.name}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
      title={`Delete team "${team.name}"?`}
      description="The team and all its members are removed. Players themselves stay on the tournament roster."
      confirmLabel="Delete team"
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
}: {
  teamId: number
  members: TeamMember[]
  allPlayers: PlayerRead[]
  playerTeamMap: PlayerTeamMap
}) {
  return (
    <div className="border-border/40 flex flex-col gap-2 border-t pt-3">
      {members.length === 0 ? (
        <p className="text-muted-foreground text-xs">No members yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <MemberChip
              key={member.profileId}
              teamId={teamId}
              member={member}
            />
          ))}
        </ul>
      )}
      <AddMemberForm
        teamId={teamId}
        members={members}
        allPlayers={allPlayers}
        playerTeamMap={playerTeamMap}
      />
    </div>
  )
}

function MemberChip({
  teamId,
  member,
}: {
  teamId: number
  member: TeamMember
}) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()

  const mutation =
    useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete(
      {
        request: { headers: { "Idempotency-Key": idempotencyKey.current } },
        mutation: {
          onSuccess: () => {
            idempotencyKey.reset()
            void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
          },
          onError: idempotencyKey.resetOnReusedKey,
        },
      }
    )

  return (
    <li>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            disabled={mutation.isPending}
            className="bg-muted/40 hover:bg-destructive/20 hover:text-destructive group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
            aria-label={`Remove ${member.alias} from team`}
          >
            <span>{member.alias}</span>
            <Trash2
              className="size-3 opacity-50 group-hover:opacity-100"
              aria-hidden
            />
          </button>
        }
        title={`Remove ${member.alias} from this team?`}
        description="The player stays on the tournament roster."
        confirmLabel="Remove"
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
 * whether to move them — only the API knows whether the underlying
 * write actually performs a move or fails with a conflict, so the
 * confirmation is the safety net regardless.
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
}: {
  teamId: number
  members: TeamMember[]
  allPlayers: PlayerRead[]
  playerTeamMap: PlayerTeamMap
}) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [selectedId, setSelectedId] = useState<string>("")
  const [pendingMove, setPendingMove] = useState<{
    profileId: number
    alias: string
    fromTeamName: string
  } | null>(null)

  const mutation =
    useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost({
      request: { headers: { "Idempotency-Key": idempotencyKey.current } },
      mutation: {
        onSuccess: () => {
          idempotencyKey.reset()
          setSelectedId("")
          setPendingMove(null)
          void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
        },
        onError: idempotencyKey.resetOnReusedKey,
      },
    })

  // Members already on *this* team are excluded from the dropdown so
  // the user can't pick a no-op. Players on *other* teams stay in the
  // list with their current team noted; picking them triggers the
  // move-confirm dialog.
  const memberIds = useMemo(
    () => new Set(members.map((m) => m.profileId)),
    [members]
  )
  const options = allPlayers.filter((p) => !memberIds.has(p.profile_id))

  const submit = (profileId: number) => {
    mutation.mutate({
      tournamentSlug: activeTournament.apiTournamentSlug,
      teamId,
      data: { profile_id: profileId },
    })
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
        alias: player?.alias ?? String(profileId),
        fromTeamName: existing.teamName,
      })
      return
    }
    submit(profileId)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label
          htmlFor={`add-member-${teamId}`}
          className="text-muted-foreground text-xs"
        >
          Add member
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
                    ? "No players available"
                    : "Pick a player"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((player) => {
                const existing = playerTeamMap.get(player.profile_id)
                return (
                  <SelectItem
                    key={player.profile_id}
                    value={String(player.profile_id)}
                  >
                    <span>{player.alias}</span>
                    {existing ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (on {existing.teamName})
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
            disabled={mutation.isPending || !selectedId}
          >
            {mutation.isPending ? "Adding…" : "Add"}
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
            <AlertDialogTitle>Move player to this team?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove
                ? `${pendingMove.alias} is currently on ${pendingMove.fromTeamName}.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove) submit(pendingMove.profileId)
              }}
            >
              Move player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CreateTeamForm() {
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
        toast.success("Team created.")
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
      className="border-border/60 flex flex-col gap-2 border-t pt-4"
    >
      <Label>Create team</Label>
      {/*
       * Stack the inputs + submit vertically on small viewports — the
       * initials, team name, and submit triplet can't share one row
       * without crowding below ~`sm:`. Side-by-side on `sm:` and up.
       */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={initials}
          onChange={(event) => setInitials(event.target.value)}
          placeholder="Initials"
          maxLength={8}
          required
          className="sm:w-24"
          aria-label="Initials"
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Team name"
          maxLength={200}
          required
          aria-label="Team name"
        />
        <Button
          type="submit"
          disabled={mutation.isPending || !name || !initials}
        >
          {mutation.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  )
}
