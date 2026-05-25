/**
 * Site-wide footer with the Microsoft Game Content Usage Rules disclaimer
 * (#35). Required because this site uses assets from Age of Empires II;
 * rendered on every route so the claim accompanies any page that surfaces
 * those assets.
 */
export function SiteFooter() {
  return (
    <footer className="border-border/50 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-[1536px] flex-col gap-1.5 px-8 py-6 text-xs">
        <p>
          A{" "}
          <a
            href="https://criticalbit.gg"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-2 transition-colors hover:underline"
          >
            criticalbit.gg
          </a>{" "}
          project.
        </p>
        <p>
          Age of Empires II © Microsoft Corporation. This site was created under
          Microsoft&apos;s{" "}
          <a
            href="https://www.xbox.com/en-us/developers/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline-offset-2 transition-colors hover:underline"
          >
            Game Content Usage Rules
          </a>{" "}
          using assets from Age of Empires II and it is not endorsed by or
          affiliated with Microsoft.
        </p>
      </div>
    </footer>
  )
}
