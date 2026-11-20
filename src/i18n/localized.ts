import type { Locale } from "./config";

/**
 * Choisit le libellé dans la bonne langue pour un objet qui a un champ
 * français et un champ arabe (par ex. `nameFr` / `nameAr`).
 * Si la version arabe manque, on affiche le français (et inversement).
 */
export function pickName(
  item: { nameFr: string; nameAr: string | null },
  lang: Locale,
): string {
  if (lang === "ar") return item.nameAr || item.nameFr;
  return item.nameFr || item.nameAr || "";
}

/** Nom complet d'une personne dans la bonne langue. */
export function personName(
  p: {
    firstName: string;
    lastName: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
  },
  lang: Locale,
): string {
  if (lang === "ar" && p.firstNameAr && p.lastNameAr) {
    return `${p.firstNameAr} ${p.lastNameAr}`;
  }
  return `${p.firstName} ${p.lastName}`;
}

/** Nom d'une classe dans la bonne langue (le nom arabe est facultatif). */
export function className(c: { name: string; nameAr?: string | null }, lang: Locale): string {
  return lang === "ar" && c.nameAr ? c.nameAr : c.name;
}
