"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { isGuardianOf } from "@/lib/data/grades";
import { FormError } from "@/lib/forms";
import { schoolAdminIds, sendPush } from "@/lib/push";

const MAX_FILE = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

/** Le parent envoie un justificatif (motif + photo ou PDF) pour une ou plusieurs absences. */
export async function submitAbsenceNote(lang: string, studentId: string, _prev: FormState, formData: FormData) {
  return runAction(lang, "children.read", async (ctx) => {
    const schoolId = ctx.school.id;
    if (!(await isGuardianOf(schoolId, ctx.user.id, studentId))) throw new FormError("forbidden");
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
    const ids = formData.getAll("recordId").map(String).slice(0, 60);
    if (!reason || ids.length === 0) throw new FormError("noteMissing");
    const records = await db.attendanceRecord.findMany({ where: { id: { in: ids }, schoolId, studentId, justified: false } });
    if (records.length === 0) throw new FormError("noteMissing");

    const file = formData.get("file");
    let fileData: Uint8Array<ArrayBuffer> | null = null;
    let fileType: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE) throw new FormError("fileTooBig");
      if (!TYPES.includes(file.type)) throw new FormError("fileType");
      fileData = new Uint8Array(await file.arrayBuffer());
      fileType = file.type;
    }
    await db.absenceNote.create({
      data: { schoolId, studentId, authorId: ctx.user.id, recordIds: records.map((r) => r.id), reason, fileData, fileType },
    });
    const school = ctx.school;
    after(async () => {
      await sendPush(await schoolAdminIds(school.id), { title: school.nameFr, body: reason, url: `/fr/absences`, tag: "absence-note" });
    });
    refresh();
    return { ok: true };
  });
}

/** La direction accepte (les absences deviennent justifiées) ou refuse le justificatif. */
export async function reviewAbsenceNote(lang: string, noteId: string, accept: boolean, _prev: FormState, _fd: FormData) {
  return runAction(lang, "attendance.justify", async (ctx) => {
    const note = await db.absenceNote.findFirst({ where: { id: noteId, schoolId: ctx.school.id, status: "PENDING" } });
    if (!note) throw new FormError("notFound");
    await db.$transaction([
      db.absenceNote.update({ where: { id: note.id }, data: { status: accept ? "ACCEPTED" : "REJECTED", reviewedAt: new Date(), reviewedById: ctx.user.id } }),
      ...(accept
        ? [
            db.attendanceRecord.updateMany({
              where: { id: { in: note.recordIds }, schoolId: ctx.school.id, studentId: note.studentId },
              data: { justified: true, reason: note.reason.slice(0, 200) },
            }),
          ]
        : []),
    ]);
    refresh();
  });
}
