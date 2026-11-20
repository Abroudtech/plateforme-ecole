// Langues de la plateforme. Le français est la langue par défaut.
export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

/** Sens d'écriture : l'arabe s'écrit de droite à gauche (RTL). */
export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Nom du cookie qui retient la langue choisie. */
export const LOCALE_COOKIE = "langue";
