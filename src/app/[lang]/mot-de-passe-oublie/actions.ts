"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/dictionaries";
import { t } from "@/i18n/format";
import { isLocale } from "@/i18n/config";
import { identifierWhere } from "@/lib/auth/identifier";
import { CODE_MINUTES, MAX_CODE_ATTEMPTS, MAX_REQUESTS_PER_HOUR, hashResetCode, newResetCode, setNewPassword } from "@/lib/auth/reset";
import { sendSms, smsConfigFromEnv } from "@/lib/sms";

export type ResetState =
  | { step?: "code" | "school"; identifier?: string; error?: "missing" | "tooMany" | "codeInvalid" | "passwordTooShort" | "passwordMismatch" }
  | undefined;

/**
 * Étape 1 : la personne donne son identifiant.
 * - SMS configuré et téléphone connu : un code à 6 chiffres est envoyé.
 * - Sinon : une demande est transmise à la direction de son école.
 * La réponse ne révèle jamais si le compte existe.
 */
export async function requestReset(_lang: string, _prev: ResetState, formData: FormData): Promise<ResetState> {
  const identifier = String(formData.get("identifier") ?? "").trim().slice(0, 120);
  if (!identifier) return { error: "missing" };
  const sms = smsConfigFromEnv();
  const where = identifierWhere(identifier);
  const user = await db.user.findUnique({
    where,
    include: { memberships: { where: { isActive: true, school: { isActive: true } }, include: { school: true } } },
  });
  const viaSms = !!sms && (user ? !!user.phone : "phone" in where);

  if (user && user.isActive && user.memberships.length > 0 && !user.isPlatformAdmin) {
    const recent = await db.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= MAX_REQUESTS_PER_HOUR) return { error: "tooMany" };
    if (viaSms && user.phone) {
      const code = newResetCode();
      const reset = await db.passwordReset.create({
        data: { userId: user.id, kind: "SMS_CODE", expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) },
      });
      await db.passwordReset.update({ where: { id: reset.id }, data: { codeHash: hashResetCode(reset.id, code) } });
      const d = await getDictionary(user.preferredLocale);
      await sendSms(sms, user.phone, t(d.reset.smsText, { code, minutes: CODE_MINUTES }));
    } else {
      // Une seule demande en attente à la fois.
      const pending = await db.passwordReset.findFirst({ where: { userId: user.id, kind: "SCHOOL", usedAt: null, expiresAt: { gt: new Date() } } });
      if (!pending) {
        await db.passwordReset.create({ data: { userId: user.id, kind: "SCHOOL", expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      }
    }
  }
  return viaSms ? { step: "code", identifier } : { step: "school" };
}

/** Étape 2 : code reçu par SMS + nouveau mot de passe. */
export async function confirmReset(rawLang: string, _prev: ResetState, formData: FormData): Promise<ResetState> {
  const lang = isLocale(rawLang) ? rawLang : "fr";
  const p = z
    .object({ identifier: z.string().trim().min(1).max(120), code: z.string().trim(), next: z.string(), confirm: z.string() })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { step: "code", error: "missing" };
  const { identifier, code, next, confirm } = p.data;
  const back = { step: "code" as const, identifier };
  if (next.length < 8) return { ...back, error: "passwordTooShort" };
  if (next !== confirm) return { ...back, error: "passwordMismatch" };

  const user = await db.user.findUnique({ where: identifierWhere(identifier) });
  const reset = user
    ? await db.passwordReset.findFirst({
        where: { userId: user.id, kind: "SMS_CODE", usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!user || !reset || reset.attempts >= MAX_CODE_ATTEMPTS) return { ...back, error: "codeInvalid" };
  if (reset.codeHash !== hashResetCode(reset.id, code.replace(/\s/g, ""))) {
    await db.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    return { ...back, error: "codeInvalid" };
  }
  await db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  await setNewPassword(user.id, next);
  redirect(`/${lang}/connexion?reinit=1`);
}
