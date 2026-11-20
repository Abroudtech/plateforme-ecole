import type { Dictionary } from "./dictionaries";

/** Textes communs passés aux formulaires (bouton, attente, erreurs). */
export function formLabels(dict: Dictionary, submit = dict.common.save) {
  return {
    submit,
    pending: dict.common.saving,
    saved: dict.common.saved,
    errors: dict.formErrors as Record<string, string>,
  };
}
