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

import { useAnalytics } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import type { HostLink, HostLinkKind } from "@/types"

/**
 * Renders a stack of host promotional links (channels, donation pages, etc.)
 * in the same elevated card chrome as the countdowns — see #60. Configured
 * via the tournament's `hostLinks`; the frontend has no opinion about which
 * links exist or where they point. Returns `null` when no links are passed
 * so the layout collapses cleanly.
 *
 * Deliberately sourced from build config — NOT the admin-saved
 * `host_stream_urls` (#225). That field is a flat URL list the API uses only
 * to detect host liveness (`host_stream_live`); it carries no labels, kinds,
 * or order and can't express the donate/Patreon entries or display sequence
 * here. The two overlapping Twitch/YouTube URLs are intentional duplication,
 * not drift — see the project memory note on this split.
 *
 * When `streamLive` is set (the API's `host_stream_live`, #149) the eyebrow
 * gains a pulsing "Live" badge and the broadcast links (Twitch / YouTube)
 * light up brand-blue with a soft glow — mirroring the standings Watch
 * column's "this channel is live right now" treatment.
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
  streamLive = false,
  className,
}: {
  links: HostLink[] | undefined
  label?: string
  logo?: string
  /**
   * Whether the host's channel is broadcasting live right now (the API's
   * `host_stream_live`, #149). When true, the eyebrow shows a pulsing "Live"
   * badge and the Twitch / YouTube links glow brand-blue. Defaults to `false`.
   */
  streamLive?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const analytics = useAnalytics()
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
        {/*
         * Live badge: when the host is broadcasting, the eyebrow carries a
         * pulsing brand pill — the same ping-ring "right now" vocabulary as the
         * standings "Live" badge. `ml-auto` parks it at the trailing edge.
         */}
        {streamLive && (
          <span
            className="bg-brand/15 text-brand ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
            aria-label={t("hostLinks.streamingLive")}
          >
            <span className="relative flex size-1.5" aria-hidden>
              <span className="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-brand relative inline-flex size-1.5 rounded-full" />
            </span>
            {t("hostLinks.live")}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {links.map((link) => {
          const Icon = KIND_ICON[link.kind] ?? ExternalLink
          // While the host is live, the broadcast links (Twitch / YouTube) glow
          // brand-blue — the channels you'd actually click to go watch. Donate
          // / Patreon stay muted so the emphasis lands on what's streaming.
          const broadcastGlow =
            streamLive && (link.kind === "twitch" || link.kind === "youtube")
          return (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                // #215: host promo-card click-through, by link kind.
                onClick={() =>
                  analytics.track("host.link.click", {
                    kind: link.kind,
                    streamLive,
                    source: "host_card",
                  })
                }
                className={cn(
                  "hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  broadcastGlow
                    ? "text-brand hover:text-brand"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={
                  broadcastGlow
                    ? {
                        textShadow:
                          "0 0 8px color-mix(in oklch, var(--brand) 60%, transparent)",
                      }
                    : undefined
                }
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
