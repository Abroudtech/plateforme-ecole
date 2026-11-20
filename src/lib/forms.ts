import { z } from "zod";

/** Texte obligatoire (espaces retirés). */
export const requiredText = z.string().trim().min(1).max(120);

/** Texte facultatif : une case vide devient `null`. */
export const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : null));

/** Lit un formulaire HTML sous forme d'objet simple. */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Erreur "attendue" dont la clé est traduite dans `formErrors`. */
export class FormError extends Error {
  constructor(public key: string) {
    super(key);
  }
}
