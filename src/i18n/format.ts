/**
 * Remplace les {variables} d'un texte traduit.
 *
 * Accord au pluriel : « {count} {count:élève|élèves} » donne « 1 élève »,
 * « 3 élèves » (0 et 1 au singulier, comme en français).
 * Avec six formes (zéro|un|deux|quelques|beaucoup|autre), la règle arabe s'applique.
 */
const AR_PLURAL = new Intl.PluralRules("ar");
const AR_ORDER = ["zero", "one", "two", "few", "many", "other"];

export function t(template: string, vars: Record<string, string | number> = {}): string {
  // 1. Accords au pluriel (les formes peuvent elles-mêmes contenir des {variables}).
  const withPlurals = template.replace(/\{(\w+):((?:[^{}]|\{\w+\})*)\}/g, (whole, key: string, forms: string) => {
    if (!(key in vars)) return whole;
    const n = Number(vars[key]);
    const list = forms.split("|");
    if (list.length === 6) return list[AR_ORDER.indexOf(AR_PLURAL.select(n))] ?? list[5];
    return Math.abs(n) < 2 ? list[0] : (list[1] ?? list[0]);
  });
  // 2. Variables simples.
  return withPlurals.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/**
 * Isole un texte écrit de gauche à droite (année "2026-2027", matricule...)
 * pour qu'il ne soit pas retourné au milieu d'une phrase en arabe.
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
