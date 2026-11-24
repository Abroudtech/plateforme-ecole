/**
 * Couleurs proposées pour la page vitrine. Chaque école choisit la sienne
 * dans « Site de l'école » ; la page entière prend ces couleurs.
 */
export const SITE_THEMES = {
  encre: { primary: "#14213d", accent: "#c9a227", soft: "#f7f4ec" },
  olivier: { primary: "#1f4d3a", accent: "#d4a72c", soft: "#f2f4ec" },
  bordeaux: { primary: "#5e1a2a", accent: "#d9a441", soft: "#faf3ef" },
  azur: { primary: "#12466e", accent: "#f0b429", soft: "#eef5f9" },
  terracotta: { primary: "#7c3419", accent: "#e3a33b", soft: "#fbf3ea" },
  violet: { primary: "#3b2766", accent: "#e6b84a", soft: "#f5f2fa" },
} as const;

export type SiteThemeName = keyof typeof SITE_THEMES;

export function siteTheme(name: string | null | undefined) {
  return SITE_THEMES[(name ?? "") as SiteThemeName] ?? SITE_THEMES.encre;
}

export function isSiteTheme(name: string): name is SiteThemeName {
  return name in SITE_THEMES;
}
