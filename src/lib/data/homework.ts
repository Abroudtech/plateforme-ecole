import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { hasClassAccess } from "@/lib/auth/scope";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };

const include = {
  subject: true,
  author: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
  resource: { select: { id: true, title: true } },
} as const;

/** Cahier de textes d'une classe, du plus récent au plus ancien. */
export function listClassHomework(schoolId: string, classGroupId: string, take = 60) {
  return db.homework.findMany({ where: { schoolId, classGroupId }, include, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take });
}

export type HomeworkItem = Awaited<ReturnType<typeof listClassHomework>>[number];

/**
 * Pour un élève (vue parent ou élève) : le travail à faire à venir, et les
 * séances des trois dernières semaines.
 */
export async function homeworkForStudent(schoolId: string, studentId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { schoolId, studentId, status: "ACTIVE", academicYear: { isCurrent: true } },
    include: { classGroup: true },
  });
  if (!enrollment) return null;
  const today = parseISODate(todayISO())!;
  const since = new Date(today.getTime() - 21 * 86_400_000);
  const classGroupId = enrollment.classGroupId;
  const [upcoming, recent] = await Promise.all([
    db.homework.findMany({ where: { schoolId, classGroupId, task: { not: null }, dueDate: { gte: today } }, include, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 50 }),
    db.homework.findMany({ where: { schoolId, classGroupId, date: { gte: since } }, include, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 60 }),
  ]);
  return { classGroup: enrollment.classGroup, upcoming, recent };
}

/** Qui peut lire une entrée : l'équipe de la classe, les parents et les élèves de la classe. */
export async function canReadHomework(ctx: Ctx, hw: { schoolId: string; classGroupId: string }) {
  if (hw.schoolId !== ctx.school.id) return false;
  if ((ctx.roles.includes("ADMIN") || ctx.roles.includes("TEACHER")) && (await hasClassAccess(ctx, hw.classGroupId))) return true;
  const enrolled = await db.enrollment.findFirst({
    where: {
      schoolId: hw.schoolId,
      classGroupId: hw.classGroupId,
      status: "ACTIVE",
      student: { OR: [{ userId: ctx.user.id }, { guardians: { some: { guardian: { userId: ctx.user.id } } } }] },
    },
    select: { id: true },
  });
  return !!enrolled;
}
