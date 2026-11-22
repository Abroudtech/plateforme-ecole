"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { setNewPassword } from "@/lib/auth/reset";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { FormError } from "@/lib/forms";

/** Demande « mot de passe oublié » d'un compte de cette école (et seulement de cette école). */
async function findRequest(schoolId: string, resetId: string) {
  const r = await db.passwordReset.findFirst({
    where: { id: resetId, kind: "SCHOOL", usedAt: null, user: { memberships: { some: { schoolId, isActive: true } } } },
    include: { user: { include: { memberships: { where: { isActive: true } } } } },
  });
  if (!r) throw new FormError("notFound");
  return r;
}

export async function giveTempPassword(lang: string, resetId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const r = await findRequest(ctx.school.id, resetId);
    // Un compte aussi utilisé dans une autre école ne peut pas être modifié d'ici.
    if (r.user.isPlatformAdmin || r.user.memberships.some((m) => m.schoolId !== ctx.school.id)) throw new FormError("accountConflict");
    const password = generateTempPassword();
    await setNewPassword(r.userId, password);
    await db.passwordReset.updateMany({
      where: { userId: r.userId, kind: "SCHOOL", usedAt: null },
      data: { usedAt: new Date(), handledById: ctx.user.id },
    });
    const login = r.user.phone ? r.user.phone.replace(/^\+216/, "") : (r.user.email ?? r.user.username ?? "");
    return { ok: true, credentials: { login, password } };
  });
}

export async function dismissReset(lang: string, resetId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "students.write", async (ctx) => {
    const r = await findRequest(ctx.school.id, resetId);
    await db.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date(), handledById: ctx.user.id } });
    refresh();
  });
}
