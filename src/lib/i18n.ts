import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import ar from "@/locales/ar.json"
import en from "@/locales/en.json"
import es from "@/locales/es.json"

/**
 * i18n setup for the SPA. English (default), Spanish, and Arabic
 * (machine-translated for the 2026 invitational — community polish
 * welcome later, see #57). Arabic is RTL: the `<html dir>` is synced
 * from i18next's `i18n.dir()` below. Language is detected from
 * localStorage first, then the browser's navigator.language; the
 * user-facing dropdown in the navbar (`LanguageToggle`) is the
 * canonical way to switch and writes back to localStorage.
 *
 * The translation files live under `src/locales/`. Keys are
 * hierarchical (e.g. `standings.headers.position`) and grouped by
 * surface so a reader can find every string for a screen by scanning
 * one branch of the JSON tree.
 */
export const LANGUAGE_STORAGE_KEY = "app_language"

export const SUPPORTED_LANGUAGES = ["en", "es", "ar"] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    // "es-MX", "es-AR" etc. all collapse to "es" — we don't ship a
    // regional split, so a country code shouldn't fall back to English.
    nonExplicitSupportedLngs: true,
    // React already escapes interpolated values when they render as
    // children, so i18next's own escaping would double-escape entities.
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
  })

// Keep `<html lang>` and `<html dir>` in sync so screen readers and the
// browser's spellcheck pick the right locale, and RTL languages (Arabic)
// flip the whole layout. `i18n.dir(lng)` returns "rtl"/"ltr" from i18next's
// built-in RTL language list. Done outside the React tree because the
// document element is global anyway and this avoids a per-render effect.
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language
  document.documentElement.dir = i18n.dir()
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng
    document.documentElement.dir = i18n.dir(lng)
  })
}

export default i18n
