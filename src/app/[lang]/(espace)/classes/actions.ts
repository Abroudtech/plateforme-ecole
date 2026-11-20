"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { parseForm, runAction } from "@/lib/actions";
import { getCurrentYear } from "@/lib/data/school";
import { FormError, optionalText, requiredText } from "@/lib/forms";

const classSchema = z.object({
  name: requiredText.max(30),
  nameAr: optionalText,
  gradeLevelId: z.string().min(1),
  trackId: optionalText,
  capacity: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(1).max(200).nullable()),
});

/** Crée une classe (classId vide) ou modifie une classe existante. */
export async function saveClass(lang: string, classId: string | null, _prev: FormState, formData: FormData) {
  return runAction(
    lang,
    "classes.write",
    async (ctx, l) => {
      const data = parseForm(classSchema, formData);
      const schoolId = ctx.school.id;

      // Le niveau et la filière doivent appartenir à cette école.
      const level = await db.gradeLevel.findFirst({ where: { id: data.gradeLevelId, schoolId } });
      if (!level || !ctx.school.cycles.includes(level.cycle)) throw new FormError("invalid");
      let trackId: string | null = null;
      if (data.trackId && level.cycle === "SECONDARY") {
        const track = await db.track.findFirst({ where: { id: data.trackId, schoolId } });
        if (!track) throw new FormError("invalid");
        trackId = track.id;
      }
      const fields = { name: data.name, nameAr: data.nameAr, gradeLevelId: level.id, trackId, capacity: data.capacity };

      if (classId) {
        const existing = await db.classGroup.findFirst({ where: { id: classId, schoolId } });
        if (!existing) throw new FormError("notFound");
        await db.classGroup.update({ where: { id: existing.id }, data: fields });
        refresh();
        return { ok: true };
      }

      const year = await getCurrentYear(schoolId);
      if (!year) throw new FormError("noYear");
      const created = await db.classGroup.create({ data: { ...fields, schoolId, academicYearId: year.id } });
      redirect(`/${l}/classes/${created.id}`);
    },
    "duplicateClass",
  );
}

/** Supprime une classe, uniquement si aucun élève n'y a jamais été inscrit. */
export async function deleteClass(lang: string, classId: string, _prev: FormState, _formData: FormData) {
  return runAction(lang, "classes.write", async (ctx, l) => {
    const existing = await db.classGroup.findFirst({
      where: { id: classId, schoolId: ctx.school.id },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!existing) throw new FormError("notFound");
    if (existing._count.enrollments > 0) throw new FormError("classNotEmpty");
    await db.classGroup.delete({ where: { id: existing.id } });
    redirect(`/${l}/classes`);
  });
}
