"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { Cycle } from "@prisma/client";
import type { FormState } from "@/components/action-form";
import { isLocale, type Locale } from "@/i18n/config";
import { parseForm } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { FormError, requiredText } from "@/lib/forms";
import { parseAmount } from "@/lib/payments";
import { normalizeDomain } from "@/lib/site/content";
import { bootstrapSchool } from "@/lib/setup/school";
import { DEMO_ADMIN_EMAIL, DEMO_PARENT_PHONE, DEMO_STUDENT_LOGIN, DEMO_TEACHER_EMAIL, seedDemoSchool } from "@/lib/setup/demo";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ecole";
}

/** Comme runAction, mais pour l'équipe de la plateforme. */
async function platformAction(rawLang: string, fn: (lang: Locale) => Promise<FormState | void>): Promise<FormState> {
  const lang: Locale = isLocale(rawLang) ? rawLang : "fr";
  await requirePlatformAdmin(lang);
  try {
    return (await fn(lang)) ?? { ok: true };
  } catch (e) {
    if (e instanceof FormError) return { error: e.key, errorParams: e.params };
    throw e;
  }
}

/** Crée une école cliente (niveaux, matières, année) et son premier compte direction. */
export async function createSchool(lang: string, _prev: FormState, formData: FormData) {
  return platformAction(lang, async () => {
    const data = parseForm(
      z.object({
        nameFr: requiredText,
        nameAr: requiredText,
        city: z.string().trim().max(80).optional(),
        yearLabel: z.string().regex(/^\d{4}-\d{4}$/),
        adminEmail: z.string().trim().toLowerCase().email(),
        adminFirstName: requiredText,
        adminLastName: requiredText,
      }),
      formData,
    );
    const cycles = formData.getAll("cycles").filter((c): c is Cycle => c === "PRIMARY" || c === "MIDDLE" || c === "SECONDARY");
    if (cycles.length === 0) throw new FormError("cyclesMissing");
    const existing = await db.user.findUnique({ where: { email: data.adminEmail }, include: { memberships: true } });
    if (existing && (existing.isPlatformAdmin || existing.memberships.some((m) => m.role !== "ADMIN"))) throw new FormError("accountConflict");

    let slug = slugify(data.nameFr);
    if (await db.school.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const { school } = await bootstrapSchool(db, { slug, nameFr: data.nameFr, nameAr: data.nameAr, city: data.city || null, cycles, yearLabel: data.yearLabel });

    let password: string | null = null;
    const user =
      existing ??
      (await db.user.create({
        data: { email: data.adminEmail, firstName: data.adminFirstName, lastName: data.adminLastName, passwordHash: await hashPassword((password = generateTempPassword(10))) },
      }));
    await db.membership.create({ data: { userId: user.id, schoolId: school.id, role: "ADMIN" } });
    refresh();
    return { ok: true, credentials: password ? { login: data.adminEmail, password } : undefined, notice: password ? undefined : "accountLinked" };
  });
}

/**
 * École de démonstration pour les testeurs de Google Play et de l'App Store :
 * la crée si besoin, et donne un nouveau mot de passe aux comptes
 * (direction, parent, enseignant, élève). À relancer pour changer le mot de passe.
 */
export async function prepareDemoSchool(lang: string, _prev: FormState, _formData: FormData) {
  return platformAction(lang, async () => {
    const password = generateTempPassword(12);
    await seedDemoSchool(db, await hashPassword(password));
    refresh();
    return { ok: true, credentials: { login: `${DEMO_ADMIN_EMAIL} · ${DEMO_PARENT_PHONE} · ${DEMO_TEACHER_EMAIL} · ${DEMO_STUDENT_LOGIN}`, password } };
  });
}

/** Abonnement : formule, prix mensuel, payé jusqu'au, note ; école active ou suspendue. */
export async function saveSubscription(lang: string, schoolId: string, _prev: FormState, formData: FormData) {
  return platformAction(lang, async () => {
    const data = parseForm(
      z.object({ plan: z.string().trim().max(60).optional(), price: z.string().optional(), paidUntil: z.string().optional(), note: z.string().trim().max(2000).optional() }),
      formData,
    );
    const price = data.price?.trim() ? parseAmount(data.price) : null;
    if (data.price?.trim() && price == null) throw new FormError("amountInvalid");
    const paidUntil = data.paidUntil ? parseISODate(data.paidUntil) : null;
    await db.school.update({
      where: { id: schoolId },
      data: { plan: data.plan || null, planPriceMillimes: price, paidUntil, platformNote: data.note || null, isActive: formData.get("isActive") === "on" },
    });
    refresh();
  });
}

/** Adresse propre de la page vitrine d'une école (ex. laplume-dor.tn). Vide : aucune. */
export async function saveSiteDomain(lang: string, schoolId: string, _prev: FormState, formData: FormData) {
  return platformAction(lang, async () => {
    const raw = String(formData.get("domain") ?? "").trim();
    const domain = raw ? normalizeDomain(raw) : null;
    if (raw && !domain) throw new FormError("domainInvalid");
    if (domain) {
      const other = await db.schoolSite.findUnique({ where: { domain } });
      if (other && other.schoolId !== schoolId) throw new FormError("domainTaken");
    }
    await db.schoolSite.upsert({ where: { schoolId }, update: { domain }, create: { schoolId, domain } });
    refresh();
  });
}
