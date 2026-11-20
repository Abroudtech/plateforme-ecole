/**
 * Identifiant de connexion d'un élève : prénom (sans accents) + matricule,
 * par exemple « yasmine.2026001 ». Facile à retenir, et unique grâce au
 * matricule ; un suffixe est ajouté si deux écoles ont le même.
 */
export function studentUsername(firstName: string, studentNumber: string, attempt = 0): string {
  const name =
    firstName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, 12) || "eleve";
  const number = studentNumber.toLowerCase().replace(/[^a-z0-9]/g, "") || "0";
  return `${name}.${number}${attempt > 0 ? `-${attempt + 1}` : ""}`;
}

/** Vrai si l'identifiant saisi a la forme d'un identifiant élève. */
export function looksLikeUsername(identifier: string) {
  return /^[a-z]+\.[a-z0-9]+(-\d+)?$/i.test(identifier.trim());
}
