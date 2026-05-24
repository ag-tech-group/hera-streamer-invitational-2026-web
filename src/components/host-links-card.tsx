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
  label = "Hosted by",
  className,
}: {
  links: HostLink[] | undefined
  label?: string
  className?: string
}) {
  if (!links || links.length === 0) return null
  return (
    <section
      className={cn(
        "bg-card shadow-card flex flex-col gap-3 rounded-lg p-4",
        className
      )}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {label}
      </p>
      <ul className="flex flex-col gap-1">
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
