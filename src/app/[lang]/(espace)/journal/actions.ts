"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { runAction } from "@/lib/actions";
import { assertClassAccess, teacherOf } from "@/lib/auth/scope";
import { findLesson } from "@/lib/curriculum";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";
import { cleanSkills, parseRows } from "@/lib/journal";
import { parseTime } from "@/lib/timetable";

const short = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim().slice(0, 20) || null : null);

/** Enregistre le journal de l'enseignant pour une classe et un jour (une seule page par jour). */
export async function saveJournal(lang: string, classId: string, isoDate: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "journal.write", async (ctx) => {
    await assertClassAccess(ctx, classId);
    const schoolId = ctx.school.id;
    const date = parseISODate(isoDate);
    if (!date) throw new FormError("dateInvalid");
    const cls = await db.classGroup.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new FormError("notFound");

    let raw: unknown = [];
    try {
      raw = JSON.parse(String(formData.get("rows") ?? "[]"));
    } catch {
      throw new FormError("invalid");
    }
    const rows = parseRows(raw);
    if (rows.length === 0) throw new FormError("journalEmpty");

    // Matières et leçons : seulement celles de l'école et du référentiel.
    const subjectIds = [...new Set(rows.map((r) => r.subjectId).filter((x): x is string => !!x))];
    const known = new Set((await db.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } })).map((s) => s.id));
    const clean = rows.map((r) => ({
      ...r,
      subjectId: r.subjectId && known.has(r.subjectId) ? r.subjectId : null,
      lessonId: r.lessonId && findLesson(r.lessonId) ? r.lessonId : null,
    }));

    const start = formData.get("start") ? parseTime(String(formData.get("start"))) : null;
    const end = formData.get("end") ? parseTime(String(formData.get("end"))) : null;
    if ((formData.get("start") && start === null) || (formData.get("end") && end === null)) throw new FormError("timeInvalid");
    if (start !== null && end !== null && end <= start) throw new FormError("endBeforeStart");

    const teacher = await teacherOf(schoolId, ctx.user.id);
    const values = {
      startMinute: start,
      endMinute: end,
      week: short(formData.get("week")),
      unit: short(formData.get("unit")),
      unitDay: short(formData.get("unitDay")),
      lifeSkills: cleanSkills(formData.getAll("skills").map(String)),
      rows: clean,
      teacherId: teacher?.id ?? null,
    };
    await db.classJournal.upsert({
      where: { classGroupId_date_authorId: { classGroupId: classId, date, authorId: ctx.user.id } },
      create: { ...values, schoolId, classGroupId: classId, date, authorId: ctx.user.id },
      update: values,
    });
    refresh();
  });
}

export async function deleteJournal(lang: string, classId: string, isoDate: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "journal.write", async (ctx, l) => {
    const date = parseISODate(isoDate);
    if (!date) throw new FormError("dateInvalid");
    await db.classJournal.deleteMany({ where: { schoolId: ctx.school.id, classGroupId: classId, date, authorId: ctx.user.id } });
    redirect(`/${l}/journal/${classId}?date=${isoDate}`);
  });
}
