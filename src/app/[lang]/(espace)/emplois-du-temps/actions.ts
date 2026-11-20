"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { FormError, optionalText, requiredText } from "@/lib/forms";
import { normalizePhone } from "@/lib/phone";
import { findConflicts, formatTime, parseTime } from "@/lib/timetable";

// ---------------------------------------------------------------------------
// Enseignants
// ---------------------------------------------------------------------------

const teacherSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  firstNameAr: optionalText,
  lastNameAr: optionalText,
  phone: optionalText,
  email: optionalText,
});

export async function saveTeacher(lang: string, teacherId: string | null, _prev: FormState, formData: FormData) {
  return runAction(lang, "staff.write", async (ctx) => {
    const data = parseForm(teacherSchema, formData);
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new FormError("phoneInvalid");
    const fields = { ...data, phone, email: data.email?.toLowerCase() ?? null };
    if (teacherId) {
      const t = await db.teacher.findFirst({ where: { id: teacherId, schoolId: ctx.school.id } });
      if (!t) throw new FormError("notFound");
      await db.teacher.update({ where: { id: t.id }, data: fields });
    } else {
      await db.teacher.create({ data: { ...fields, schoolId: ctx.school.id } });
    }
    refresh();
  });
}

export async function setTeacherActive(lang: string, teacherId: string, active: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "staff.write", async (ctx) => {
    await db.teacher.updateMany({ where: { id: teacherId, schoolId: ctx.school.id }, data: { isActive: active } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Salles
// ---------------------------------------------------------------------------

export async function addRoom(lang: string, _prev: FormState, formData: FormData) {
  return runAction(
    lang,
    "staff.write",
    async (ctx) => {
      const { name, capacity } = parseForm(
        z.object({
          name: requiredText.max(40),
          capacity: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1).max(500).nullable()),
        }),
        formData,
      );
      await db.room.create({ data: { schoolId: ctx.school.id, name, capacity } });
      refresh();
    },
    "duplicateRoom",
  );
}

export async function deleteRoom(lang: string, roomId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "staff.write", async (ctx) => {
    await db.room.deleteMany({ where: { id: roomId, schoolId: ctx.school.id } });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Cours de l'emploi du temps
// ---------------------------------------------------------------------------

export async function addTimetableEntry(lang: string, classId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "timetable.write", async (ctx, l) => {
    const schoolId = ctx.school.id;
    const cls = await db.classGroup.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new FormError("notFound");

    const dayOfWeek = Number(formData.get("dayOfWeek"));
    const startMinute = parseTime(String(formData.get("start") ?? ""));
    const endMinute = parseTime(String(formData.get("end") ?? ""));
    if (!(dayOfWeek >= 1 && dayOfWeek <= 6)) throw new FormError("invalid");
    if (startMinute === null || endMinute === null || endMinute <= startMinute) throw new FormError("timeInvalid");

    // Matière au programme de la classe ; enseignant et salle de cette école.
    const subjectId = String(formData.get("subjectId") ?? "");
    const taught = await db.curriculumSubject.findFirst({
      where: { schoolId, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId, subjectId },
    });
    if (!taught) throw new FormError("invalid");
    const teacherId = String(formData.get("teacherId") ?? "") || null;
    const roomId = String(formData.get("roomId") ?? "") || null;
    if (teacherId && !(await db.teacher.findFirst({ where: { id: teacherId, schoolId } }))) throw new FormError("invalid");
    if (roomId && !(await db.room.findFirst({ where: { id: roomId, schoolId } }))) throw new FormError("invalid");

    const entry = { classGroupId: cls.id, subjectId, teacherId, roomId, dayOfWeek, startMinute, endMinute };

    // Conflits avec les cours de l'année (même classe, même enseignant, même salle).
    const existing = await db.timetableEntry.findMany({
      where: { schoolId, dayOfWeek, classGroup: { academicYearId: cls.academicYearId } },
      include: { classGroup: true },
    });
    const conflict = findConflicts(entry, existing)[0];
    if (conflict) {
      const c = conflict.with;
      const detail = `${l === "ar" && c.classGroup.nameAr ? c.classGroup.nameAr : c.classGroup.name}, ${formatTime(c.startMinute)}–${formatTime(c.endMinute)}`;
      const key = { class: "conflictClass", teacher: "conflictTeacher", room: "conflictRoom" }[conflict.kind];
      throw new FormError(key, { detail });
    }

    await db.timetableEntry.create({ data: { ...entry, schoolId } });
    refresh();
  });
}

export async function deleteTimetableEntry(lang: string, entryId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "timetable.write", async (ctx) => {
    await db.timetableEntry.deleteMany({ where: { id: entryId, schoolId: ctx.school.id } });
    refresh();
  });
}
