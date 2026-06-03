/**
 * Civ **emblem** assets for the civ pick/win chart (#302).
 *
 * Names now come straight from the API (`/civ-stats`, `/civilizations` #227) —
 * the frontend no longer maps civ ids to names. We tried that from the game
 * install's `civilizations.json` and it was wrong: the World's Edge leaderboard
 * civ ids the API forwards are **alphabetical** (0 = Armenians, 1 = Aztecs, …),
 * a different id space from the install's dat-file order (Britons = 1, …), so an
 * id like 27 meant Berbers locally but Magyars upstream. So this file keeps only
 * the heraldic shields (still sourced from the install) and resolves them by the
 * API's civ **name**, which is stable across both id spaces.
 *
 * The colored shields live in `public/civ-emblems/<basename>.webp`, exported
 * from the install's `widgetui/textures/menu/civs/` (see memory / #302).
 */

/**
 * Basenames of every committed shield in `public/civ-emblems/` (from the
 * AoE2:DE install). The API's ladder names lower-case straight onto these, so
 * this doubles as the set of civs we can show an emblem for. Regenerate when
 * civs are added (re-export the install textures + extend this list).
 */
const EMBLEM_BASENAMES: ReadonlySet<string> = new Set([
  "achaemenids",
  "armenians",
  "athenians",
  "aztecs",
  "bengalis",
  "berbers",
  "bohemians",
  "britons",
  "bulgarians",
  "burgundians",
  "burmese",
  "byzantines",
  "celts",
  "chinese",
  "cumans",
  "dravidians",
  "ethiopians",
  "franks",
  "georgians",
  "goths",
  "gurjaras",
  "huns",
  "incas",
  "indians",
  "italians",
  "japanese",
  "jurchens",
  "khitans",
  "khmer",
  "koreans",
  "lithuanians",
  "macedonians",
  "magyars",
  "malay",
  "malians",
  "mapuche",
  "mayans",
  "mongols",
  "muisca",
  "persians",
  "poles",
  "portuguese",
  "puru",
  "romans",
  "saracens",
  "shu",
  "sicilians",
  "slavs",
  "spanish",
  "spartans",
  "tatars",
  "teutons",
  "thracians",
  "tupi",
  "turks",
  "vietnamese",
  "vikings",
  "wei",
  "wu",
])

/**
 * Civ names whose spelling doesn't lower-case onto their asset basename.
 * Empty in effect today — the API uses the legacy ladder names (e.g. "Indians"),
 * which already match the filenames — but this guards the one known rename
 * ("Indians" → "Hindustanis") so the emblem still resolves if upstream ever
 * switches to the current in-game name.
 */
const NAME_TO_EMBLEM: Record<string, string> = { Hindustanis: "indians" }

/**
 * Public URL for a civ's emblem by its API name, honoring the build's base
 * path — or `null` if we have no shield for it (a civ newer than this install
 * snapshot, or an unexpected name). Consumers render the name alone in that
 * case rather than a broken image.
 */
export function civEmblemUrl(name: string): string | null {
  const base =
    NAME_TO_EMBLEM[name] ?? name.toLowerCase().replace(/[^a-z0-9]/g, "")
  return EMBLEM_BASENAMES.has(base)
    ? `${import.meta.env.BASE_URL}civ-emblems/${base}.webp`
    : null
}
