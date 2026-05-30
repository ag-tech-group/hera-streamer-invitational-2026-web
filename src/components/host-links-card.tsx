import {
  ExternalLink,
  Globe,
  HandHeart,
  Tv2,
  Twitch,
  Youtube,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import type { HostLink, HostLinkKind } from "@/types"

/**
 * Renders a stack of host promotional links (channels, donation pages, etc.)
 * in the same elevated card chrome as the countdowns — see #60. Configured
 * via the tournament's `hostLinks`; the frontend has no opinion about which
 * links exist or where they point. Returns `null` when no links are passed
 * so the layout collapses cleanly.
 */
type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

const KIND_ICON: Record<HostLinkKind, IconComponent> = {
  twitch: Twitch,
  youtube: Youtube,
  patreon: PatreonIcon,
  stream: Tv2,
  donate: HandHeart,
  social: Globe,
  other: ExternalLink,
}

export function HostLinksCard({
  links,
  label,
  logo,
  className,
}: {
  links: HostLink[] | undefined
  label?: string
  logo?: string
  className?: string
}) {
  const { t } = useTranslation()
  if (!links || links.length === 0) return null
  return (
    <section
      className={cn(
        "bg-card shadow-card relative flex flex-col gap-3 overflow-hidden rounded-lg p-4",
        className
      )}
    >
      {/*
       * Broadcast-card chrome (#114): brand-blue accent stripe + soft
       * upper-right corner glow, matching the team panels, the standings
       * table, and the countdown cards. Same JSX recipe so every card on
       * the page frames data the same way.
       */}
      <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-[3px]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-80 blur-3xl"
        style={{
          background: "color-mix(in oklch, var(--brand) 12%, transparent)",
        }}
      />
      {/*
       * Host brand mark + eyebrow label. The logo is decorative — the
       * adjacent label already names the host — so alt="" keeps screen
       * readers from announcing it twice (mirrors the navbar logo).
       */}
      <div className="flex items-center gap-2.5">
        {logo ? <img src={logo} alt="" className="size-8 shrink-0" /> : null}
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {label ?? t("hostLinks.defaultLabel")}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {links.map((link) => {
          const Icon = KIND_ICON[link.kind] ?? ExternalLink
          return (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              >
                <Icon className="text-brand size-4 shrink-0" aria-hidden />
                <span>{link.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Patreon brand mark (current single-shape glyph from their 2024 refresh).
 * Inlined as an SVG component because Lucide doesn't ship a Patreon icon —
 * and a single component avoids pulling in a whole brand-icon package for
 * one missing glyph. Path data from simpleicons.org.
 */
function PatreonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
    </svg>
  )
}
