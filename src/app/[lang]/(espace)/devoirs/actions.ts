"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/action-form";
import { runAction } from "@/lib/actions";
import { studentOf } from "@/lib/data/class-space";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";

/** L'élève coche (ou décoche) un devoir de sa classe. */
export async function toggleHomeworkDone(lang: string, homeworkId: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "student.space", async (ctx) => {
    const student = await studentOf(ctx.school.id, ctx.user.id);
    const hw = await db.homework.findFirst({ where: { id: homeworkId, schoolId: ctx.school.id } });
    if (!student?.classGroup || !hw || hw.classGroupId !== student.classGroup.id) throw new FormError("forbidden");
    const key = { homeworkId_studentId: { homeworkId, studentId: student.id } };
    if (await db.homeworkDone.findUnique({ where: key })) await db.homeworkDone.delete({ where: key });
    else await db.homeworkDone.create({ data: { homeworkId, studentId: student.id } });
    refresh();
    return { ok: true };
  });
}
