"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { parseForm, runAction } from "@/lib/actions";
import { assertClassAccess } from "@/lib/auth/scope";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";

const longText = z.string().trim().max(4000).optional().transform((v) => v || null);

/** Ajoute ou modifie une séance du cahier de textes (ce qui a été fait, travail à faire). */
export async function saveHomework(lang: string, classId: string, id: string | null, _prev: FormState, formData: FormData) {
  return runAction(lang, "homework.write", async (ctx, l) => {
    await assertClassAccess(ctx, classId);
    const data = parseForm(
      z.object({
        date: z.string(),
        subjectId: z.string().optional(),
        lesson: longText,
        task: longText,
        dueDate: z.string().optional(),
        resourceId: z.string().optional(),
      }),
      formData,
    );
    const schoolId = ctx.school.id;
    const date = parseISODate(data.date);
    if (!date) throw new FormError("invalid");
    const dueDate = data.dueDate ? parseISODate(data.dueDate) : null;
    if (data.dueDate && !dueDate) throw new FormError("invalid");
    if (dueDate && dueDate < date) throw new FormError("dueBeforeDate");
    if (!data.lesson && !data.task) throw new FormError("homeworkEmpty");
    const cls = await db.classGroup.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw new FormError("notFound");
    const subject = data.subjectId ? await db.subject.findFirst({ where: { id: data.subjectId, schoolId } }) : null;
    if (data.subjectId && !subject) throw new FormError("invalid");
    const isAdmin = ctx.roles.includes("ADMIN");
    const resource = data.resourceId
      ? await db.teachingResource.findFirst({ where: { id: data.resourceId, schoolId, ...(isAdmin ? {} : { authorId: ctx.user.id }) } })
      : null;
    if (data.resourceId && !resource) throw new FormError("invalid");

    const values = { date, dueDate, subjectId: subject?.id ?? null, lesson: data.lesson, task: data.task, resourceId: resource?.id ?? null };
    if (id) {
      const existing = await db.homework.findFirst({ where: { id, schoolId, classGroupId: classId } });
      if (!existing) throw new FormError("notFound");
      if (!isAdmin && existing.authorId !== ctx.user.id) throw new FormError("forbidden");
      await db.homework.update({ where: { id }, data: values });
      redirect(`/${l}/classes/${classId}/cahier`);
    }
    await db.homework.create({ data: { ...values, schoolId, classGroupId: classId, authorId: ctx.user.id } });
    refresh();
  });
}

export async function deleteHomework(lang: string, classId: string, id: string, _prev: FormState, _fd: FormData) {
  return runAction(lang, "homework.write", async (ctx) => {
    await assertClassAccess(ctx, classId);
    const existing = await db.homework.findFirst({ where: { id, schoolId: ctx.school.id, classGroupId: classId } });
    if (!existing) throw new FormError("notFound");
    if (!ctx.roles.includes("ADMIN") && existing.authorId !== ctx.user.id) throw new FormError("forbidden");
    await db.homework.delete({ where: { id } });
    refresh();
  });
}
