import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey } from "@/api/generated/hooks/tournaments/tournaments"
import {
  useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost,
  useCreateTeamV1TournamentsTournamentSlugTeamsPost,
  useDeleteTeamV1TournamentsTournamentSlugTeamsTeamIdDelete,
  useRemoveTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersProfileIdDelete,
  useUpdateTeamV1TournamentsTournamentSlugTeamsTeamIdPatch,
} from "@/api/generated/hooks/teams/teams"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activeTournament } from "@/config/tournaments"
import { useIdempotencyKey } from "@/hooks/use-idempotency-key"
import { useTeamStandings } from "@/hooks/use-team-standings"
import { getUserMessage, parseApiError } from "@/lib/api-errors"
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
  const rows = teams.data?.rows ?? []

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
            <TeamItem key={team.teamId} team={team} />
          ))}
        </ul>
      )}
      <CreateTeamForm />
    </div>
  )
}

function teamsQueryKey() {
  return getGetTeamStandingsV1TournamentsTournamentSlugTeamsStandingsGetQueryKey(
    activeTournament.apiTournamentSlug
  )
}

/** One team's full admin card: header (name/initials/edit/delete) + members + add-member form. */
function TeamItem({ team }: { team: TeamStandingsRow }) {
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

      <MembersBlock teamId={team.teamId} members={team.members} />
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
      onError: async (error) => surfaceError(error),
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
      onError: async (error) => surfaceError(error),
    },
  })

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => {
        // Plain confirm() instead of a custom dialog — admin UI, low
        // traffic, and a destructive op deserves a "are you sure" beat.
        if (!confirm(`Delete team "${team.name}"? Members will be removed.`)) {
          return
        }
        mutation.mutate({
          tournamentSlug: activeTournament.apiTournamentSlug,
          teamId: team.teamId,
        })
      }}
      aria-label={`Delete ${team.name}`}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  )
}

function MembersBlock({
  teamId,
  members,
}: {
  teamId: number
  members: TeamMember[]
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
      <AddMemberForm teamId={teamId} />
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
          onError: async (error) => surfaceError(error),
        },
      }
    )

  return (
    <li>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            tournamentSlug: activeTournament.apiTournamentSlug,
            teamId,
            profileId: member.profileId,
          })
        }
        className="bg-muted/40 hover:bg-destructive/20 hover:text-destructive group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
        aria-label={`Remove ${member.alias} from team`}
      >
        <span>{member.alias}</span>
        <Trash2
          className="size-3 opacity-50 group-hover:opacity-100"
          aria-hidden
        />
      </button>
    </li>
  )
}

function AddMemberForm({ teamId }: { teamId: number }) {
  const queryClient = useQueryClient()
  const idempotencyKey = useIdempotencyKey()
  const [profileId, setProfileId] = useState("")

  const mutation =
    useAddTeamMemberV1TournamentsTournamentSlugTeamsTeamIdMembersPost({
      request: { headers: { "Idempotency-Key": idempotencyKey.current } },
      mutation: {
        onSuccess: () => {
          idempotencyKey.reset()
          setProfileId("")
          void queryClient.invalidateQueries({ queryKey: teamsQueryKey() })
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
          teamId,
          data: { profile_id: Number(profileId) },
        })
      }}
      className="flex gap-2"
    >
      <Input
        type="number"
        inputMode="numeric"
        value={profileId}
        onChange={(event) => setProfileId(event.target.value)}
        placeholder="profile_id"
        min={1}
        required
        className="h-8 text-xs"
        aria-label="Profile ID to add"
      />
      <Button
        type="submit"
        size="sm"
        disabled={mutation.isPending || !profileId}
      >
        {mutation.isPending ? "Adding…" : "Add"}
      </Button>
    </form>
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
      onError: async (error) => surfaceError(error),
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
      <div className="flex gap-2">
        <Input
          value={initials}
          onChange={(event) => setInitials(event.target.value)}
          placeholder="Initials"
          maxLength={8}
          required
          className="w-24"
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

async function surfaceError(error: unknown) {
  const normalized = await parseApiError(error)
  toast.error(getUserMessage(normalized), {
    description: normalized.requestId
      ? `Reference: ${normalized.requestId}`
      : undefined,
  })
}
