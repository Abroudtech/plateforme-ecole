import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { FormState } from "@/components/action-form";
import { isLocale, type Locale } from "@/i18n/config";
import { requirePermission } from "@/lib/auth/context";
import type { Permission } from "@/lib/auth/permissions";
import { FormError, formToObject } from "@/lib/forms";

/**
 * Enveloppe commune des actions de formulaire :
 * 1. vérifie que la personne est connectée et a le droit d'agir ;
 * 2. transforme les erreurs prévues en message lisible ;
 * 3. laisse passer les redirections.
 */
export async function runAction(
  rawLang: string,
  permission: Permission,
  fn: (ctx: Awaited<ReturnType<typeof requirePermission>>, lang: Locale) => Promise<FormState | void>,
  duplicateKey = "invalid",
): Promise<FormState> {
  const lang: Locale = isLocale(rawLang) ? rawLang : "fr";
  const ctx = await requirePermission(lang, permission);
  try {
    return (await fn(ctx, lang)) ?? { ok: true };
  } catch (e) {
    if (e instanceof FormError) return { error: e.key, errorParams: e.params };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: duplicateKey };
    }
    throw e;
  }
}

/** Valide un formulaire avec un schéma ; sinon erreur "invalid". */
export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  const result = schema.safeParse(formToObject(formData));
  if (!result.success) throw new FormError("invalid");
  return result.data;
}
