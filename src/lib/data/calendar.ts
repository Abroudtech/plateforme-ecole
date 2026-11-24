import "server-only";
import type { AppContext } from "@/lib/auth/context";
import { scopeOf } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { sendPush, type PushMessage } from "@/lib/push";

type Ctx = Pick<AppContext, "roles" | "user"> & { school: { id: string } };

/**
 * Classes dont la personne voit le calendrier :
 * `classIds: null` pour la direction (toute l'école) ; sinon les classes de
 * l'enseignant, de ses enfants (parent) ou la sienne (élève).
 * `childByClass` donne le prénom de l'enfant à afficher pour un parent.
 */
export async function agendaScope(ctx: Ctx) {
  const schoolId = ctx.school.id;
  if (ctx.roles.includes("ADMIN")) return { classIds: null, levelIds: null, childByClass: new Map<string, string[]>() };
  const classIds = new Set<string>();
  const childByClass = new Map<string, string[]>();
  if (ctx.roles.includes("TEACHER")) for (const id of (await scopeOf(ctx)) ?? []) classIds.add(id);
  const year = { status: "ACTIVE" as const, academicYear: { isCurrent: true } };
  if (ctx.roles.includes("PARENT") || ctx.roles.includes("STUDENT")) {
    const enrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        ...year,
        student: { isActive: true, OR: [{ userId: ctx.user.id }, { guardians: { some: { guardian: { userId: ctx.user.id } } } }] },
      },
      include: { student: { select: { firstName: true, firstNameAr: true, userId: true } } },
    });
    for (const e of enrollments) {
      classIds.add(e.classGroupId);
      // Prénom de l'enfant seulement pour un parent (pas pour l'élève lui-même).
      if (e.student.userId !== ctx.user.id) childByClass.set(e.classGroupId, [...(childByClass.get(e.classGroupId) ?? []), e.student.firstName]);
    }
  }
  const ids = [...classIds];
  const classes = await db.classGroup.findMany({ where: { schoolId, id: { in: ids } }, select: { gradeLevelId: true } });
  return { classIds: ids, levelIds: [...new Set(classes.map((c) => c.gradeLevelId))], childByClass };
}

const examInclude = {
  classGroup: { select: { id: true, name: true, nameAr: true, gradeLevelId: true } },
  subject: true,
  author: { select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
} as const;

/** Examens entre deux dates (incluses), pour les classes données (null = toutes). */
export function listExams(schoolId: string, classIds: string[] | null, from: Date, to?: Date) {
  return db.exam.findMany({
    where: { schoolId, ...(classIds ? { classGroupId: { in: classIds } } : {}), date: { gte: from, ...(to ? { lte: to } : {}) } },
    include: examInclude,
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    take: 300,
  });
}

/** Examens passés, du plus récent au plus ancien. */
export function listPastExams(schoolId: string, classIds: string[] | null, before: Date, take = 30) {
  return db.exam.findMany({
    where: { schoolId, ...(classIds ? { classGroupId: { in: classIds } } : {}), date: { lt: before } },
    include: { ...examInclude, assessment: { select: { id: true, _count: { select: { grades: true } } } } },
    orderBy: [{ date: "desc" }, { startMinute: "desc" }],
    take,
  });
}

export type ExamRow = Awaited<ReturnType<typeof listExams>>[number];

/** Dates de l'école visibles pour un ensemble de classes et de niveaux (null = toutes). */
export function listEvents(schoolId: string, scope: { classIds: string[] | null; levelIds: string[] | null }, from: Date, to?: Date) {
  return db.schoolEvent.findMany({
    where: {
      schoolId,
      // Une date sur plusieurs jours reste visible jusqu'à son dernier jour.
      OR: [{ date: { gte: from } }, { endDate: { gte: from } }],
      ...(to ? { date: { lte: to } } : {}),
      ...(scope.classIds
        ? {
            AND: [
              {
                OR: [
                  { audience: "SCHOOL" },
                  { audience: "LEVEL", gradeLevelId: { in: scope.levelIds ?? [] } },
                  { audience: "CLASS", classGroupId: { in: scope.classIds } },
                ],
              },
            ],
          }
        : {}),
    },
    include: { gradeLevel: true, classGroup: true },
    orderBy: { date: "asc" },
    take: 200,
  });
}

/** Comptes des élèves et des parents des classes données (pour les prévenir sur leur téléphone). */
export async function familyUserIds(schoolId: string, classIds: string[] | null, levelId?: string | null) {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      academicYear: { isCurrent: true },
      ...(classIds ? { classGroupId: { in: classIds } } : {}),
      ...(levelId ? { classGroup: { gradeLevelId: levelId } } : {}),
    },
    select: { student: { select: { userId: true, guardians: { select: { guardian: { select: { userId: true } } } } } } },
  });
  const ids = new Set<string>();
  for (const e of enrollments) {
    if (e.student.userId) ids.add(e.student.userId);
    for (const g of e.student.guardians) if (g.guardian.userId) ids.add(g.guardian.userId);
  }
  return [...ids];
}

/**
 * Prévient sur leur téléphone, chacun dans sa langue, les élèves et les parents
 * des classes données. Ne lève jamais d'erreur (lancé après la réponse).
 */
export async function pushFamilies(
  schoolId: string,
  target: { classIds: string[] | null; levelId?: string | null },
  build: (dict: Dictionary, lang: Locale) => PushMessage,
) {
  try {
    const ids = await familyUserIds(schoolId, target.classIds, target.levelId);
    if (ids.length === 0) return;
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, preferredLocale: true } });
    const [fr, ar] = await Promise.all([getDictionary("fr"), getDictionary("ar")]);
    const byLang = { fr: build(fr, "fr"), ar: build(ar, "ar") };
    const locale = new Map(users.map((u) => [u.id, u.preferredLocale]));
    await sendPush(ids, (userId) => byLang[locale.get(userId) ?? "fr"]);
  } catch (e) {
    console.error("Calendrier : notification impossible", e);
  }
}
