import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export function NotFound() {
  return (
    // `flex-1` fills the available space inside the app shell's `<main>`
    // (between the persistent navbar and the footer) rather than the
    // whole viewport — keeps the user's navigation chrome visible.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
        Page not found
      </p>
      <h1 className="text-primary text-7xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground text-base">
        Sorry, we couldn't find the page you're looking for.
      </p>
      <Button asChild>
        <Link to="/">Go back home</Link>
      </Button>
    </div>
  )
}
