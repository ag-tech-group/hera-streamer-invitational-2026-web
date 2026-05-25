import { User } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Small circular avatar for criticalbit users. Renders the supplied
 * `avatarUrl` when present; falls back to a Lucide silhouette when
 * unset (or when the image errors at load time — `onError` hides the
 * `<img>` so the fallback takes over via CSS).
 *
 * Used by the owners list, the user-search picker, and anywhere else
 * the SPA surfaces a user identity.
 */
export function UserAvatar({
  avatarUrl,
  size = "sm",
  className,
}: {
  avatarUrl: string | null | undefined
  size?: "xs" | "sm" | "md"
  className?: string
}) {
  const dimensions = {
    xs: "size-4",
    sm: "size-5",
    md: "size-8",
  }[size]

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover",
          dimensions,
          className
        )}
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    )
  }
  return (
    <User
      className={cn("text-muted-foreground shrink-0", dimensions, className)}
      aria-hidden
    />
  )
}
