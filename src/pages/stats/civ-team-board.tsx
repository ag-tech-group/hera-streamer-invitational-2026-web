import { useTranslation } from "react-i18next"

import type {
  CivTop,
  PlayerCivSummary,
  TeamCivGroup,
} from "@/pages/stats/civ-by-team"

type Kind = "picks" | "win"

/** A civ's heraldic shield, or a held slot when the emblem is unresolved. */
function Emblem({ civ, className }: { civ: CivTop; className: string }) {
  return civ.emblemUrl ? (
    <img
      src={civ.emblemUrl}
      alt=""
      loading="lazy"
      className={`${className} shrink-0`}
    />
  ) : (
    <span className={`${className} shrink-0`} aria-hidden />
  )
}

/**
 * A column's value: pick count, or win% + win count. The win column mirrors the
 * overall civ board (#330) — the faint trailing number is *wins*, not picks.
 */
function CivValue({ civ, kind }: { civ: CivTop; kind: Kind }) {
  if (kind === "picks") return <>{civ.picks}</>
  return (
    <>
      {civ.winPct.toFixed(0)}%{" "}
      <span className="text-muted-foreground/70 text-xs font-normal">
        {civ.wins}
      </span>
    </>
  )
}

/**
 * The #1 civ in a column, enlarged for broadcast legibility: a large shield
 * beside the civ name and a `font-display` value (pick count, or win% + wins).
 */
function HeroCiv({ civ, kind }: { civ: CivTop; kind: Kind }) {
  return (
    <div className="flex items-center gap-3">
      <Emblem civ={civ} className="size-12" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" title={civ.name}>
          {civ.name}
        </p>
        <p className="font-display text-2xl leading-none tabular-nums">
          <CivValue civ={civ} kind={kind} />
        </p>
      </div>
    </div>
  )
}

/** A runner-up civ (rank 2–3): a compact shield + name + value row. */
function RunnerUp({ civ, kind }: { civ: CivTop; kind: Kind }) {
  return (
    <li className="flex items-center gap-2">
      <Emblem civ={civ} className="size-5" />
      <span className="min-w-0 flex-1 truncate text-sm" title={civ.name}>
        {civ.name}
      </span>
      <span className="shrink-0 text-sm tabular-nums">
        <CivValue civ={civ} kind={kind} />
      </span>
    </li>
  )
}

/** A bordered column: its leader enlarged as a hero, then runners-up beneath. */
function CivColumn({
  title,
  civs,
  kind,
  emptyHint,
}: {
  title: string
  civs: CivTop[]
  kind: Kind
  emptyHint: string
}) {
  const [hero, ...rest] = civs
  return (
    // Neutral box (no team wash) — team colour stays on the card bloom/stripe
    // and the roster pills, so these data containers read as a calm middle layer.
    <div className="min-w-0 rounded-lg border p-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
        {title}
      </p>
      {!hero ? (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      ) : (
        <>
          <HeroCiv civ={hero} kind={kind} />
          {rest.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5">
              {rest.map((c) => (
                <RunnerUp key={c.civId} civ={c} kind={kind} />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * A roster member, rendered with the Teams-tab `.team-pill` treatment (team-hued
 * border, gradient, glow): their name, then their #1 main civ enlarged, with any
 * other mains smaller. The `--team-color` vars come from the card's
 * `data-team-color`, so the pill tints itself per team like the Teams panels.
 */
function MemberRow({ player }: { player: PlayerCivSummary }) {
  const [main, ...rest] = player.topPicks
  return (
    <li className="team-pill flex flex-col gap-1.5 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <span
        className="truncate text-sm font-medium sm:w-28 sm:shrink-0"
        title={player.label}
      >
        {player.label}
      </span>
      {/* All of a member's mains share one wrap row: the #1 enlarged, the rest
          compact, each with its pick count. Wrapping (not truncating) keeps the
          civ names whole on phones. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {main ? (
          <span className="flex items-center gap-1.5">
            <Emblem civ={main} className="size-7" />
            <span className="text-sm font-medium">{main.name}</span>
            <span className="text-sm tabular-nums">{main.picks}</span>
          </span>
        ) : null}
        {rest.map((c) => (
          <span
            key={c.civId}
            className="text-muted-foreground inline-flex items-center gap-1 text-xs"
          >
            <Emblem civ={c} className="size-4" />
            <span>{c.name}</span>
            <span className="tabular-nums">{c.picks}</span>
          </span>
        ))}
      </div>
    </li>
  )
}

/** One team's card: a team-hued panel with its civ identity, then its roster. */
function TeamCard({ group }: { group: TeamCivGroup }) {
  const { t } = useTranslation()
  const hasTeamCivs = group.topPicks.length > 0

  return (
    <div
      data-team-color={group.colorSlot}
      className="bg-background/40 relative isolate overflow-hidden rounded-lg border p-5 ps-6"
    >
      {/* Team-colour atmosphere, mirroring the Teams panels: an accent stripe
          down the start edge and a soft bloom from the top corner (held behind
          the content with -z-10 so it lights the card without washing text). */}
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-1"
        style={{ background: "var(--team-color)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-20 -z-10 size-48 rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--team-color-bg)" }}
      />
      <h3
        className="font-display mb-4 truncate text-lg font-semibold tracking-wide"
        style={{ color: "var(--team-color-strong)" }}
        title={group.name}
      >
        {group.name}
      </h3>

      {hasTeamCivs ? (
        // Picks | win% stack on phones (each hero gets the full card width so
        // civ names aren't truncated), side-by-side once the card is wide enough.
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CivColumn
            title={t("stats.civ.topPicks")}
            civs={group.topPicks}
            kind="picks"
            emptyHint={t("stats.civ.notEnough")}
          />
          <CivColumn
            title={t("stats.civ.topWins")}
            civs={group.topWins}
            kind="win"
            emptyHint={t("stats.civ.notEnough")}
          />
        </div>
      ) : (
        <p className="text-muted-foreground py-1 text-sm">
          {t("stats.civ.noGamesYet")}
        </p>
      )}

      {group.players.length > 0 ? (
        <>
          <div className="my-4 flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
              {t("stats.civ.roster")}
            </span>
            <span className="bg-border h-px flex-1" aria-hidden />
            {/* The member civs are each player's mains — label the metric so the
                roster isn't ambiguous against the team's picks/win% columns. */}
            <span className="text-muted-foreground/70 text-[10px] tracking-wide">
              {t("stats.civ.mostPlayed")}
            </span>
          </div>
          <ul className="space-y-2">
            {group.players.map((p) => (
              <MemberRow key={p.tournamentPlayerId} player={p} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

/**
 * "Civs by team" (#302 follow-up): each team's civ identity as a card grid,
 * sized for broadcast. A team-hued panel leads with the roster's aggregate top
 * pick + best win-rate civ enlarged as hero tiles (ranks 2–3 beneath, each in
 * its own bordered box), then a roster of bordered, team-tinted rows — each
 * member's name and the civs they main, their #1 scaled up. Civ names are shown
 * outright (not hover-only) — identification is the whole point — and the team
 * colour ties each card to that team across the rest of /stats.
 *
 * Plain HTML/CSS rather than echarts so each civ's coloured heraldic shield
 * renders as a native `<img>`, like the civ board above it.
 */
export function CivByTeam({ groups }: { groups: TeamCivGroup[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((g) => (
        <TeamCard key={g.teamId} group={g} />
      ))}
    </div>
  )
}
