import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Circular avatar for criticalbit users. Mirrors the criticalbit-web /
 * vagrant-story-web / criticalbit-auth-web pattern (same `sm` / `lg`
 * sizes, same initials-monogram fallback) — diverges only in taking the
 * identity as props rather than from `useAuth`, because this component
 * is also used to render *other* users in the owners list and the user
 * search picker.
 *
 * Falls back to a colored circle with the first letter of `email` (or
 * `displayName` for Steam users whose email isn't set) when no avatar
 * URL is supplied, or when the image fails to load (CSP, 404, etc.).
 */
export function UserAvatar({
  avatarUrl,
  email,
  displayName,
  size = "sm",
  className,
}: {
  avatarUrl?: string | null
  email?: string | null
  displayName?: string | null
  size?: "sm" | "lg"
  className?: string
}) {
  const sizeClass = size === "lg" ? "size-16 text-2xl" : "size-7 text-xs"
  const [imageBroken, setImageBroken] = useState(false)

  if (avatarUrl && !imageBroken) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover",
          sizeClass,
          className
        )}
        onError={() => setImageBroken(true)}
      />
    )
  }

  const initial = (email?.[0] ?? displayName?.[0] ?? "?").toUpperCase()
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-full font-medium",
        sizeClass,
        className
      )}
    >
      {initial}
    </div>
  )
}
