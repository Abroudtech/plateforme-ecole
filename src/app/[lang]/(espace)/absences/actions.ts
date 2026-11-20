"use server";

import { assertClassAccess } from "@/lib/auth/scope";
import { refresh } from "next/cache";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { parseISODate } from "@/lib/dates";
import { FormError } from "@/lib/forms";
import { t } from "@/i18n/format";
import { alertGuardiansOf } from "@/lib/data/alerts";

const PERIODS = ["MORNING", "AFTERNOON"] as const;

/**
 * Enregistre l'appel d'une classe (champ "status_<élève>" = PRESENT, ABSENT ou LATE).
 * Une absence déjà justifiée garde sa justification si son statut ne change pas.
 */
export async function saveRollCall(lang: string, classId: string, dateISO: string, period: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "attendance.write", async (ctx) => {
    const schoolId = ctx.school.id;
    const date = parseISODate(dateISO);
    const p = PERIODS.find((x) => x === period);
    if (!date || !p) throw new FormError("invalid");
    await assertClassAccess(ctx, classId);

    const cls = await db.classGroup.findFirst({
      where: { schoolId, id: classId },
      include: { enrollments: { where: { status: "ACTIVE" } } },
    });
    if (!cls) throw new FormError("notFound");
    const existing = await db.attendanceRecord.findMany({ where: { schoolId, classGroupId: cls.id, date, period: p } });
    const byStudent = new Map(existing.map((r) => [r.studentId, r]));
    const newlyMarked: { studentId: string; status: "ABSENT" | "LATE" }[] = [];

    await db.$transaction(async (tx) => {
      for (const { studentId } of cls.enrollments) {
        const value = String(formData.get(`status_${studentId}`) ?? "PRESENT");
        const before = byStudent.get(studentId);
        if (value === "PRESENT") {
          if (before) await tx.attendanceRecord.delete({ where: { id: before.id } });
        } else if (value === "ABSENT" || value === "LATE") {
          if (!before || before.status !== value) newlyMarked.push({ studentId, status: value });
          if (!before) {
            await tx.attendanceRecord.create({ data: { schoolId, studentId, classGroupId: cls.id, date, period: p, status: value } });
          } else if (before.status !== value) {
            await tx.attendanceRecord.update({ where: { id: before.id }, data: { status: value, justified: false, reason: null } });
          }
        } else {
          throw new FormError("invalid");
        }
      }
      await tx.rollCall.upsert({
        where: { classGroupId_date_period: { classGroupId: cls.id, date, period: p } },
        update: {},
        create: { schoolId, classGroupId: cls.id, date, period: p },
      });
    });

    // Alerte SMS aux parents des élèves nouvellement notés absents ou en retard.
    if (ctx.school.alertAbsence) {
      for (const status of ["ABSENT", "LATE"] as const) {
        await alertGuardiansOf(
          ctx.school,
          newlyMarked.filter((m) => m.status === status).map((m) => m.studentId),
          "ABSENCE",
          (d, lg, v) =>
            t(status === "ABSENT" ? d.alerts.absence : d.alerts.late, {
              ...v,
              date: new Intl.DateTimeFormat(lg === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "long", timeZone: "UTC" }).format(date),
              period: d.attendance.periods[p],
            }),
        );
      }
    }
    refresh();
  });
}

/** Justifie (ou non) une absence ou un retard, avec un motif. */
export async function setJustification(lang: string, recordId: string, justified: boolean, _prev: FormState, formData: FormData) {
  return runAction(lang, "attendance.justify", async (ctx) => {
    const record = await db.attendanceRecord.findFirst({ where: { id: recordId, schoolId: ctx.school.id } });
    if (!record) throw new FormError("notFound");
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || null;
    await db.attendanceRecord.update({
      where: { id: record.id },
      data: { justified, reason: justified ? reason : record.reason },
    });
    refresh();
  });
}
