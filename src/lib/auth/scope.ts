import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { FormError } from "@/lib/forms";
import type { AppContext } from "./context";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };

/**
 * Classes accessibles à la personne connectée :
 * - `null` pour l'administration (toutes les classes) ;
 * - pour un enseignant, ses classes de l'année en cours (confiées par la
 *   direction ou présentes dans son emploi du temps) ;
 * - aucune classe pour les autres rôles.
 */
export const classScope = cache(async (schoolId: string, userId: string, isAdmin: boolean, isTeacher: boolean): Promise<string[] | null> => {
  if (isAdmin) return null;
  if (!isTeacher) return [];
  const teacher = await db.teacher.findFirst({
    where: { schoolId, userId, isActive: true },
    include: {
      assignments: { where: { classGroup: { academicYear: { isCurrent: true } } }, select: { classGroupId: true } },
      entries: { where: { classGroup: { academicYear: { isCurrent: true } } }, select: { classGroupId: true } },
    },
  });
  if (!teacher) return [];
  return [...new Set([...teacher.assignments, ...teacher.entries].map((x) => x.classGroupId))];
});

export function scopeOf(ctx: Ctx) {
  return classScope(ctx.school.id, ctx.user.id, ctx.roles.includes("ADMIN"), ctx.roles.includes("TEACHER"));
}

/** Fiche enseignant reliée au compte connecté (ou null). */
export const teacherOf = cache((schoolId: string, userId: string) =>
  db.teacher.findFirst({ where: { schoolId, userId, isActive: true } }),
);

export async function hasClassAccess(ctx: Ctx, classId: string) {
  const ids = await scopeOf(ctx);
  return ids === null || ids.includes(classId);
}

/** Dans une action : refuse si la classe n'est pas accessible. */
export async function assertClassAccess(ctx: Ctx, classId: string) {
  if (!(await hasClassAccess(ctx, classId))) throw new FormError("forbidden");
}

/** Dans une page : « accès refusé » si la classe n'est pas accessible. */
export async function requireClassAccess(lang: Locale, ctx: Ctx, classId: string) {
  if (!(await hasClassAccess(ctx, classId))) redirect(`/${lang}/acces-refuse`);
}

/** Un élève est accessible s'il est inscrit (cette année) dans une classe accessible. */
export async function hasStudentAccess(ctx: Ctx, studentId: string) {
  const ids = await scopeOf(ctx);
  if (ids === null) return true;
  const e = await db.enrollment.findFirst({
    where: { schoolId: ctx.school.id, studentId, classGroupId: { in: ids }, academicYear: { isCurrent: true } },
  });
  return !!e;
}
