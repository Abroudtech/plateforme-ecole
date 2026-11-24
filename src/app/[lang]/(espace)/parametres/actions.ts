"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Cycle } from "@prisma/client";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { getTerms } from "@/lib/data/grades";
import { getCurrentYear } from "@/lib/data/school";
import { FormError, optionalText, requiredText } from "@/lib/forms";
import { parseWeights } from "@/lib/grades/annual";
import { normalizePhone } from "@/lib/phone";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";

const CYCLES = ["PRIMARY", "MIDDLE", "SECONDARY"] as const;

export async function saveSchoolInfo(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    const data = parseForm(
      z.object({
        nameFr: requiredText,
        nameAr: requiredText,
        address: optionalText,
        city: optionalText,
        phone: optionalText,
        email: optionalText,
        addressAr: optionalText,
        cityAr: optionalText,
        directorName: optionalText,
        directorNameAr: optionalText,
      }),
      formData,
    );
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new FormError("phoneInvalid");
    await db.school.update({ where: { id: ctx.school.id }, data: { ...data, phone, email: data.email?.toLowerCase() ?? null } });
    refresh();
  });
}

/** Les parents voient (ou non) les notes au fil du trimestre. */
export async function saveGradesVisibility(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    await db.school.update({ where: { id: ctx.school.id }, data: { showGradesToParents: formData.get("showGradesToParents") === "on" } });
    refresh();
  });
}

export async function saveTeacherMessaging(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    await db.school.update({ where: { id: ctx.school.id }, data: { teacherMessaging: formData.get("teacherMessaging") === "on" } });
    refresh();
  });
}

export async function saveAnnualRule(lang: string, cycle: Cycle, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    if (!CYCLES.includes(cycle)) throw new FormError("invalid");
    const { weights, passMark } = parseForm(z.object({ weights: z.string(), passMark: z.string() }), formData);
    const year = await getCurrentYear(ctx.school.id);
    const count = year ? (await getTerms(ctx.school.id, year.id, cycle)).length : 3;
    const termWeights = parseWeights(weights, count || 3);
    if (!termWeights) throw new FormError("weightsInvalid");
    const pass = Number(passMark.replace(",", "."));
    if (!Number.isFinite(pass) || pass < 0 || pass > 20) throw new FormError("passMarkInvalid");
    await db.annualRule.upsert({
      where: { schoolId_cycle: { schoolId: ctx.school.id, cycle } },
      update: { termWeights, passMark: pass },
      create: { schoolId: ctx.school.id, cycle, termWeights, passMark: pass },
    });
    refresh();
  });
}

export async function resetAnnualRule(lang: string, cycle: Cycle, _prev: FormState, _fd: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    await db.annualRule.deleteMany({ where: { schoolId: ctx.school.id, cycle } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Équipe de l'administration
// ---------------------------------------------------------------------------

export async function addAdmin(lang: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(lang, "settings.write", async (ctx) => {
    const data = parseForm(z.object({ firstName: requiredText, lastName: requiredText, email: z.string().trim().toLowerCase() }), formData);
    if (!z.email().safeParse(data.email).success) throw new FormError("emailInvalid");
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      const m = await db.membership.findUnique({ where: { userId_schoolId_role: { userId: existing.id, schoolId: ctx.school.id, role: "ADMIN" } } });
      if (m?.isActive) throw new FormError("alreadyAdmin");
      await db.membership.upsert({
        where: { userId_schoolId_role: { userId: existing.id, schoolId: ctx.school.id, role: "ADMIN" } },
        update: { isActive: true },
        create: { userId: existing.id, schoolId: ctx.school.id, role: "ADMIN" },
      });
      refresh();
      return { ok: true };
    }
    const password = generateTempPassword(10);
    await db.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: await hashPassword(password),
        preferredLocale: ctx.school.defaultLocale,
        memberships: { create: { schoolId: ctx.school.id, role: "ADMIN" } },
      },
    });
    refresh();
    return { ok: true, credentials: { login: data.email, password } };
  });
}

export async function removeAdmin(lang: string, userId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    if (userId === ctx.user.id) throw new FormError("cannotRemoveSelf");
    await db.membership.updateMany({ where: { userId, schoolId: ctx.school.id, role: "ADMIN" }, data: { isActive: false } });
    // Ses sessions ouvertes sur cette école ne donnent plus accès (vérifié à chaque page).
    refresh();
  });
}
