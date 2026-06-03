/**
 * Relic `civilization_id` → display name + emblem, for the civ pick/win chart
 * (#302).
 *
 * Sourced from the game's own data so names and ids stay authoritative: the
 * array index of `civilizations.json`'s `civilization_list` IS the relic civ id
 * (validated against the live match data — id 27 = Berbers, 7 = Byzantines, …),
 * display names come from the en string table (so id 20 reads "Hindustanis",
 * not the legacy internal name "Indians"), and the colored heraldic shields are
 * exported from `widgetui/textures/menu/civs/` to `public/civ-emblems/`.
 *
 * Covers ids 1–59. Id 0 (Gaia) and any civ newer than this snapshot (e.g. the
 * id 60 already seen in live data) aren't here and resolve to `null` — consumers
 * skip them. Regenerate from the install when civs are added.
 */
export interface Civilization {
  /** Current official display name (e.g. "Hindustanis"). */
  name: string
  /** Emblem asset basename → `public/civ-emblems/<emblem>.webp`. */
  emblem: string
}

export const CIV_BY_ID: Record<number, Civilization> = {
  1: { name: "Britons", emblem: "britons" },
  2: { name: "Franks", emblem: "franks" },
  3: { name: "Goths", emblem: "goths" },
  4: { name: "Teutons", emblem: "teutons" },
  5: { name: "Japanese", emblem: "japanese" },
  6: { name: "Chinese", emblem: "chinese" },
  7: { name: "Byzantines", emblem: "byzantines" },
  8: { name: "Persians", emblem: "persians" },
  9: { name: "Saracens", emblem: "saracens" },
  10: { name: "Turks", emblem: "turks" },
  11: { name: "Vikings", emblem: "vikings" },
  12: { name: "Mongols", emblem: "mongols" },
  13: { name: "Celts", emblem: "celts" },
  14: { name: "Spanish", emblem: "spanish" },
  15: { name: "Aztecs", emblem: "aztecs" },
  16: { name: "Maya", emblem: "mayans" },
  17: { name: "Huns", emblem: "huns" },
  18: { name: "Koreans", emblem: "koreans" },
  19: { name: "Italians", emblem: "italians" },
  20: { name: "Hindustanis", emblem: "indians" },
  21: { name: "Inca", emblem: "incas" },
  22: { name: "Magyars", emblem: "magyars" },
  23: { name: "Slavs", emblem: "slavs" },
  24: { name: "Portuguese", emblem: "portuguese" },
  25: { name: "Ethiopians", emblem: "ethiopians" },
  26: { name: "Malians", emblem: "malians" },
  27: { name: "Berbers", emblem: "berbers" },
  28: { name: "Khmer", emblem: "khmer" },
  29: { name: "Malay", emblem: "malay" },
  30: { name: "Burmese", emblem: "burmese" },
  31: { name: "Vietnamese", emblem: "vietnamese" },
  32: { name: "Bulgarians", emblem: "bulgarians" },
  33: { name: "Tatars", emblem: "tatars" },
  34: { name: "Cumans", emblem: "cumans" },
  35: { name: "Lithuanians", emblem: "lithuanians" },
  36: { name: "Burgundians", emblem: "burgundians" },
  37: { name: "Sicilians", emblem: "sicilians" },
  38: { name: "Poles", emblem: "poles" },
  39: { name: "Bohemians", emblem: "bohemians" },
  40: { name: "Dravidians", emblem: "dravidians" },
  41: { name: "Bengalis", emblem: "bengalis" },
  42: { name: "Gurjaras", emblem: "gurjaras" },
  43: { name: "Romans", emblem: "romans" },
  44: { name: "Armenians", emblem: "armenians" },
  45: { name: "Georgians", emblem: "georgians" },
  46: { name: "Achaemenids", emblem: "achaemenids" },
  47: { name: "Athenians", emblem: "athenians" },
  48: { name: "Spartans", emblem: "spartans" },
  49: { name: "Shu", emblem: "shu" },
  50: { name: "Wu", emblem: "wu" },
  51: { name: "Wei", emblem: "wei" },
  52: { name: "Jurchens", emblem: "jurchens" },
  53: { name: "Khitans", emblem: "khitans" },
  54: { name: "Macedonians", emblem: "macedonians" },
  55: { name: "Thracians", emblem: "thracians" },
  56: { name: "Puru", emblem: "puru" },
  57: { name: "Muisca", emblem: "muisca" },
  58: { name: "Mapuche", emblem: "mapuche" },
  59: { name: "Tupi", emblem: "tupi" },
}

/**
 * Resolves a relic civ id to its display data, or `null` for an id this map
 * doesn't cover — Gaia (0) or a civ newer than the snapshot. Consumers skip
 * unknown ids rather than inventing a label.
 */
export function civById(id: number): Civilization | null {
  return CIV_BY_ID[id] ?? null
}

/** Public URL for a civ emblem, honoring the build's base path. */
export function civEmblemUrl(emblem: string): string {
  return `${import.meta.env.BASE_URL}civ-emblems/${emblem}.webp`
}
