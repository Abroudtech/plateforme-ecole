"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { parseForm, runAction } from "@/lib/actions";
import { assertClassAccess } from "@/lib/auth/scope";
import { termForDate } from "@/lib/calendar";
import { pushFamilies } from "@/lib/data/calendar";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";
import { parseTime } from "@/lib/timetable";

const examSchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().min(1),
  kind: z.enum(["CONTROL", "SYNTHESIS", "ORAL", "PRACTICAL", "OTHER"]),
  date: z.string(),
  time: z.string().optional(),
  duration: z.string().optional(),
  room: z.string().trim().max(60).optional(),
  title: z.string().trim().max(160).optional(),
  revision: z.string().trim().max(2000).optional(),
  resourceId: z.string().optional(),
  notify: z.string().optional(),
});

/** Date courte dans la langue voulue (« mardi 2 décembre »). */
function dayLabel(d: Date, lang: string) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

/** Annonce (ou modifie) un examen pour une classe. */
export async function saveExam(lang: string, id: string | null, _prev: FormState, formData: FormData) {
  let goTo: string | null = null;
  const state = await runAction(lang, "exams.write", async (ctx, l) => {
    const data = parseForm(examSchema, formData);
    const schoolId = ctx.school.id;
    await assertClassAccess(ctx, data.classGroupId);
    const date = parseISODate(data.date);
    if (!date) throw new FormError("dateInvalid");
    const startMinute = data.time ? parseTime(data.time) : null;
    if (data.time && startMinute == null) throw new FormError("timeInvalid");
    const duration = data.duration ? Number(data.duration) : null;
    if (duration != null && (!Number.isInteger(duration) || duration < 5 || duration > 300)) throw new FormError("invalid");

    const [cls, subject] = await Promise.all([
      db.classGroup.findFirst({ where: { id: data.classGroupId, schoolId } }),
      db.subject.findFirst({ where: { id: data.subjectId, schoolId } }),
    ]);
    if (!cls || !subject) throw new FormError("invalid");
    const isAdmin = ctx.roles.includes("ADMIN");
    const resource = data.resourceId
      ? await db.teachingResource.findFirst({ where: { id: data.resourceId, schoolId, ...(isAdmin ? {} : { authorId: ctx.user.id }) } })
      : null;
    if (data.resourceId && !resource) throw new FormError("invalid");

    const values = {
      classGroupId: cls.id,
      subjectId: subject.id,
      kind: data.kind,
      date,
      startMinute,
      durationMinutes: duration,
      room: data.room || null,
      title: data.title || null,
      revision: data.revision || null,
      resourceId: resource?.id ?? null,
    };

    let examId: string;
    if (id) {
      const existing = await db.exam.findFirst({ where: { id, schoolId } });
      if (!existing) throw new FormError("notFound");
      await assertClassAccess(ctx, existing.classGroupId);
      if (!isAdmin && existing.authorId !== ctx.user.id) throw new FormError("forbidden");
      await db.exam.update({ where: { id }, data: values });
      // Le carnet de notes suit la date et le type de l'examen.
      if (existing.assessmentId) await db.assessment.update({ where: { id: existing.assessmentId }, data: { date, kind: data.kind, title: values.title } });
      examId = id;
    } else {
      if (data.date < todayISO()) throw new FormError("examPast");
      const created = await db.exam.create({ data: { ...values, schoolId, authorId: ctx.user.id } });
      examId = created.id;
    }

    if (data.notify === "on") {
      const subjectNames = subject;
      after(() =>
        pushFamilies(schoolId, { classIds: [cls.id] }, (d, lg) => ({
          title: t(d.exams.pushTitle, { subject: pickName(subjectNames, lg) }),
          body: values.revision
            ? t(d.exams.pushBody, { class: className(cls, lg), date: dayLabel(date, lg), revision: values.revision.slice(0, 120) })
            : t(d.exams.pushBodyShort, { class: className(cls, lg), date: dayLabel(date, lg) }),
          url: `/${lg}/calendrier`,
          tag: `exam-${examId}`,
        })),
      );
    }
    goTo = `/${l}/examens/${examId}`;
  });
  if (goTo) redirect(goTo);
  return state;
}

export async function deleteExam(lang: string, id: string, _prev: FormState, _fd: FormData) {
  let done = false;
  const state = await runAction(lang, "exams.write", async (ctx) => {
    const exam = await db.exam.findFirst({ where: { id, schoolId: ctx.school.id } });
    if (!exam) throw new FormError("notFound");
    await assertClassAccess(ctx, exam.classGroupId);
    if (!ctx.roles.includes("ADMIN") && exam.authorId !== ctx.user.id) throw new FormError("forbidden");
    // Les notes déjà saisies restent dans le carnet de notes.
    await db.exam.delete({ where: { id } });
    done = true;
  });
  if (done) redirect(`/${lang}/examens`);
  return state;
}

/**
 * « Saisir les notes » : crée (une seule fois) l'évaluation correspondante
 * dans le carnet de notes de la classe, au bon trimestre, puis ouvre la saisie.
 */
export async function gradeExam(lang: string, id: string, _prev: FormState, _fd: FormData) {
  let goTo: string | null = null;
  const state = await runAction(lang, "grades.write", async (ctx, l) => {
    const schoolId = ctx.school.id;
    const exam = await db.exam.findFirst({ where: { id, schoolId }, include: { classGroup: true } });
    if (!exam) throw new FormError("notFound");
    await assertClassAccess(ctx, exam.classGroupId);
    let assessmentId = exam.assessmentId;
    if (!assessmentId) {
      const terms = await db.term.findMany({
        where: { schoolId, academicYearId: exam.classGroup.academicYearId, OR: [{ cycle: null }, { cycle: (await db.gradeLevel.findUnique({ where: { id: exam.classGroup.gradeLevelId } }))?.cycle }] },
      });
      const term = termForDate(terms, exam.date.toISOString().slice(0, 10));
      if (!term) throw new FormError("noYear");
      const a = await db.assessment.create({
        data: { schoolId, classGroupId: exam.classGroupId, subjectId: exam.subjectId, termId: term.id, kind: exam.kind, title: exam.title, date: exam.date },
      });
      await db.exam.update({ where: { id: exam.id }, data: { assessmentId: a.id } });
      assessmentId = a.id;
    }
    goTo = `/${l}/classes/${exam.classGroupId}/notes/${assessmentId}`;
  });
  if (goTo) redirect(goTo);
  return state;
}

// --- Dates de l'école (direction) ---------------------------------------------

const eventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["HOLIDAY", "MEETING", "EVENT", "TRIP", "OTHER"]),
  date: z.string(),
  endDate: z.string().optional(),
  details: z.string().trim().max(2000).optional(),
  audience: z.string().optional(),
  notify: z.string().optional(),
});

export async function saveEvent(lang: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "events.write", async (ctx) => {
    const data = parseForm(eventSchema, formData);
    const schoolId = ctx.school.id;
    const date = parseISODate(data.date);
    if (!date) throw new FormError("dateInvalid");
    const endDate = data.endDate ? parseISODate(data.endDate) : null;
    if (data.endDate && !endDate) throw new FormError("dateInvalid");
    if (endDate && endDate < date) throw new FormError("endBeforeStart");

    // « SCHOOL », « level:<id> » ou « class:<id> ».
    const [kind, targetId] = (data.audience || "SCHOOL").split(":");
    let audience: "SCHOOL" | "LEVEL" | "CLASS" = "SCHOOL";
    let gradeLevelId: string | null = null;
    let classGroupId: string | null = null;
    if (kind === "level") {
      if (!(await db.gradeLevel.findFirst({ where: { id: targetId, schoolId } }))) throw new FormError("invalid");
      audience = "LEVEL";
      gradeLevelId = targetId;
    } else if (kind === "class") {
      if (!(await db.classGroup.findFirst({ where: { id: targetId, schoolId } }))) throw new FormError("invalid");
      audience = "CLASS";
      classGroupId = targetId;
    }

    const ev = await db.schoolEvent.create({
      data: { schoolId, title: data.title, kind: data.kind, date, endDate, details: data.details || null, audience, gradeLevelId, classGroupId, createdById: ctx.user.id },
    });
    if (data.notify === "on") {
      after(() =>
        pushFamilies(schoolId, { classIds: classGroupId ? [classGroupId] : null, levelId: gradeLevelId }, (d, lg) => ({
          title: `${d.calendar.eventKinds[ev.kind]} · ${dayLabel(date, lg)}`,
          body: ev.title,
          url: `/${lg}/calendrier`,
          tag: `event-${ev.id}`,
        })),
      );
    }
    refresh();
    return { ok: true };
  });
}

export async function deleteEvent(lang: string, id: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "events.write", async (ctx) => {
    const ev = await db.schoolEvent.findFirst({ where: { id, schoolId: ctx.school.id } });
    if (!ev) throw new FormError("notFound");
    await db.schoolEvent.delete({ where: { id } });
    refresh();
  });
}
