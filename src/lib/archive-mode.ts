/**
 * Archive mode (#375): a build-time switch that serves the frozen tournament
 * fully static, with no live backend at request time.
 *
 * When `VITE_ARCHIVE_MODE=true` is set for a build, the app:
 *   - routes every read through bundled static JSON under `public/data/`
 *     instead of the live API (see `src/api/archive-data.ts`);
 *   - skips the auth probe, the feature-flags fetch, and the SSE stream — all
 *     of which would otherwise hit a backend that no longer exists; and
 *   - disables the admin surface (nav item + `/admin` route).
 *
 * It exists so the King's Gauntlet site can keep rendering its final standings
 * after the API backend is scaled down to a dormant posture. Everything reverts
 * by setting the flag back to false for the next event's live deploy.
 *
 * Vite statically replaces `import.meta.env.VITE_ARCHIVE_MODE` at build time, so
 * on a normal (non-archive) build this constant folds to `false` and every
 * `if (ARCHIVE_MODE)` branch is dead-code-eliminated — the archive plumbing adds
 * nothing to the live bundle.
 */
export const ARCHIVE_MODE = import.meta.env.VITE_ARCHIVE_MODE === "true"
