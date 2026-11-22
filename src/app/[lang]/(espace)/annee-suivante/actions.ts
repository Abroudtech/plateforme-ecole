"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { getCurrentYear } from "@/lib/data/school";
import { getNextYear, prepareNextYear, savePromotion, switchBack, switchToNextYear } from "@/lib/data/rollover";
import { FormError } from "@/lib/forms";

export async function prepareYear(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    const label = String(formData.get("label") ?? "").trim();
    if (!/^\d{4}-\d{4}$/.test(label)) throw new FormError("yearLabel");
    if (await getNextYear(ctx.school.id)) throw new FormError("yearExists");
    if (await db.academicYear.findFirst({ where: { schoolId: ctx.school.id, label } })) throw new FormError("yearExists");
    if (!(await getCurrentYear(ctx.school.id))) throw new FormError("noYear");
    await prepareNextYear(ctx.school.id, label, {
      teachers: formData.get("teachers") === "on",
      timetable: formData.get("timetable") === "on",
      discounts: formData.get("discounts") === "on",
    });
    refresh();
  });
}

/** Supprime une année préparée par erreur (tant qu'aucun paiement, note ou absence n'y est enregistré). */
export async function deletePreparedYear(lang: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    const next = await getNextYear(ctx.school.id);
    if (!next) throw new FormError("notFound");
    const [payments, assessments, attendance] = await Promise.all([
      db.payment.count({ where: { academicYearId: next.id } }),
      db.assessment.count({ where: { classGroup: { academicYearId: next.id } } }),
      db.attendanceRecord.count({ where: { classGroup: { academicYearId: next.id } } }),
    ]);
    if (payments + assessments + attendance > 0) throw new FormError("yearInUse");
    await db.$transaction([
      db.enrollment.updateMany({ where: { schoolId: ctx.school.id, nextStep: "LEAVE", status: "ACTIVE" }, data: { nextStep: null } }),
      db.academicYear.delete({ where: { id: next.id } }),
    ]);
    refresh();
  });
}

export async function savePromotionForm(lang: string, classId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "settings.write", async (ctx, l) => {
    const next = await getNextYear(ctx.school.id);
    if (!next) throw new FormError("notFound");
    const choices = new Map<string, string>();
    for (const [k, v] of formData.entries()) if (k.startsWith("dest_")) choices.set(k.slice(5), String(v));
    await savePromotion(ctx.school.id, classId, next.id, choices);
    redirect(`/${l}/annee-suivante`);
  });
}

export async function switchYear(lang: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "settings.write", async (ctx, l) => {
    const [current, next] = await Promise.all([getCurrentYear(ctx.school.id), getNextYear(ctx.school.id)]);
    if (!current || !next) throw new FormError("notFound");
    if ((await db.classGroup.count({ where: { academicYearId: next.id } })) === 0) throw new FormError("noClassesNextYear");
    await switchToNextYear(ctx.school.id, current.id, next.id);
    redirect(`/${l}/tableau-de-bord`);
  });
}

export async function undoSwitch(lang: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "settings.write", async (ctx) => {
    const current = await getCurrentYear(ctx.school.id);
    if (!current) throw new FormError("notFound");
    const previous = await db.academicYear.findFirst({
      where: { schoolId: ctx.school.id, isCurrent: false, startDate: { lt: current.startDate } },
      orderBy: { startDate: "desc" },
    });
    if (!previous) throw new FormError("notFound");
    // Seulement juste après la bascule : rien n'a encore été saisi dans la nouvelle année.
    const [payments, assessments, attendance] = await Promise.all([
      db.payment.count({ where: { academicYearId: current.id } }),
      db.assessment.count({ where: { classGroup: { academicYearId: current.id } } }),
      db.attendanceRecord.count({ where: { classGroup: { academicYearId: current.id } } }),
    ]);
    if (payments + assessments + attendance > 0) throw new FormError("yearInUse");
    await switchBack(ctx.school.id, current.id, previous.id);
    refresh();
  });
}
