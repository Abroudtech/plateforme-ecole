"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireContext } from "@/lib/auth/context";
import { isLocale } from "@/i18n/config";

function langOf(raw: string) {
  return isLocale(raw) ? raw : "fr";
}

/** Change le mot de passe et déconnecte les autres appareils. */
export async function changePassword(rawLang: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext(langOf(rawLang));
  const parsed = z.object({ current: z.string(), next: z.string(), confirm: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { current, next, confirm } = parsed.data;
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "wrongPassword" };
  if (next.length < 8) return { error: "passwordTooShort" };
  if (next !== confirm) return { error: "passwordMismatch" };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }),
    db.session.deleteMany({ where: { userId: user.id, id: { not: ctx.session.id } } }),
  ]);
  return { ok: true };
}

export async function setPreferredLocale(rawLang: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireContext(langOf(rawLang));
  const value = String(formData.get("locale") ?? "");
  if (!isLocale(value)) return { error: "invalid" };
  await db.user.update({ where: { id: ctx.user.id }, data: { preferredLocale: value } });
  refresh();
  return { ok: true };
}
