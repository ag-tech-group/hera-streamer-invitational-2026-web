import type { ReactNode } from "react"

import { ContextCards } from "@/components/context-cards"
import { TournamentHero } from "@/components/tournament-hero"
import { ViewTabs, type NavView } from "@/components/view-tabs"

/**
 * Shared shell for the three top-level tournament views — `/` (players),
 * `/teams`, and `/stats`. Every route renders the same chrome (the centered
 * logo hero, the horizontal context-card strip, and the view-tab bar) and
 * only swaps the body below the tabs, so the page structure lives in one
 * place instead of being duplicated per page (#180).
 *
 * `tabsTrailing` fills the right side of the tab row — the players/teams
 * views pass their "last updated" badge; stats passes nothing.
 */
export function TournamentLayout({
  view,
  tabsTrailing,
  children,
}: {
  view: NavView
  tabsTrailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1536px] flex-col gap-6 p-8">
      <TournamentHero />
      <ContextCards />
      <div className="flex flex-col gap-6">
        {/*
         * Tab row with an optional right-aligned trailing slot. `flex-wrap`
         * lets the trailing content drop to its own line on viewports too
         * narrow to share a row with the tabs; `ml-auto` keeps it right.
         */}
        <div className="flex flex-wrap items-center gap-3">
          <ViewTabs value={view} />
          {tabsTrailing ? <div className="ml-auto">{tabsTrailing}</div> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
