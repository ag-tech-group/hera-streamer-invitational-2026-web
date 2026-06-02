import { BookOpen, ExternalLink, Film, Globe, Youtube } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { useTranslation } from "react-i18next"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useAnalytics } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import type { TournamentLink, TournamentLinkKind } from "@/types"

/**
 * A slim, full-width row of tournament *resource* links — info video, trailer,
 * handbook, Liquipedia, Discord (#273/#274/#276/#277) — rendered as chips
 * between the context-card strip and the view tabs.
 *
 * Deliberately NOT a card and NOT part of the `ContextCards` grid: these are
 * "learn about / follow the event" links, a different category from the host's
 * own watch/support channels on `HostLinksCard`, and a fifth card would force
 * the card row onto a second line. Config-driven via the tournament's
 * `tournamentLinks` — the frontend has no opinion about which links exist;
 * returns `null` when none are passed so the slot collapses cleanly (mirroring
 * `HostLinksCard`).
 */
type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

const KIND_ICON: Record<TournamentLinkKind, IconComponent> = {
  video: Youtube,
  trailer: Film,
  handbook: BookOpen,
  wiki: Globe,
  discord: DiscordIcon,
  other: ExternalLink,
}

export function TournamentLinksBar({
  links,
  className,
}: {
  links: TournamentLink[] | undefined
  className?: string
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
  if (!links || links.length === 0) return null
  return (
    <nav
      aria-label={t("tournamentLinks.navLabel")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {links.map((link) => {
        const Icon = KIND_ICON[link.kind] ?? ExternalLink
        const chip = (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            // #215-style click-through, by link kind. `source` distinguishes
            // these from the host card's `host.link.click`.
            onClick={() =>
              analytics.track("tournament.link.click", {
                kind: link.kind,
                source: "resource_bar",
              })
            }
            className={cn(
              "border-border/60 bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "hover:border-brand/40 hover:text-foreground"
            )}
          >
            <Icon className="text-brand size-4 shrink-0" aria-hidden />
            <span>{link.label}</span>
          </a>
        )
        if (!link.tooltip) return chip
        // Optional easter-egg blurb. The long `openDelay` means it only
        // surfaces on a deliberate, lingering hover — not a casual pass — so it
        // stays a hidden treat. HoverCard (desktop hover) is the same tooltip
        // primitive the win% / bio hints use; no touch popover, since a hidden
        // joke needs no tap affordance.
        return (
          <HoverCard key={link.url} openDelay={3500} closeDelay={100}>
            <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
            <HoverCardContent className="tooltip-surface w-auto max-w-xs text-sm">
              {link.tooltip}
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </nav>
  )
}

/**
 * Discord brand mark. Inlined as an SVG component because Lucide doesn't ship a
 * Discord icon — and a single component avoids pulling in a whole brand-icon
 * package for one missing glyph, exactly like `HostLinksCard`'s `PatreonIcon`.
 * Path data from simpleicons.org.
 */
function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  )
}
