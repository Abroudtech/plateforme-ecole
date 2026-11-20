/** Remplace les {variables} d'un texte traduit. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/**
 * Isole un texte écrit de gauche à droite (année "2026-2027", matricule...)
 * pour qu'il ne soit pas retourné au milieu d'une phrase en arabe.
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
