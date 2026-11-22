import { normalizePhone } from "@/lib/phone";
import { looksLikeUsername } from "@/lib/student/username";

/** Recherche d'un compte par e-mail, identifiant élève (« prenom.matricule ») ou téléphone. */
export function identifierWhere(identifier: string): { email: string } | { username: string } | { phone: string } {
  const id = identifier.trim();
  return id.includes("@")
    ? { email: id.toLowerCase() }
    : looksLikeUsername(id)
      ? { username: id.toLowerCase() }
      : { phone: normalizePhone(id) ?? id };
}
