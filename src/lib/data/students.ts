import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Mots d'une recherche (« Ahmed Ben » → deux mots, chacun doit correspondre). */
export function wordsOf(q?: string) {
  return (q ?? "").trim().split(/\s+/).filter((w) => w.length > 0).slice(0, 5);
}

function matchAny(fields: string[], word: string) {
  return fields.map((field) => ({ [field]: { contains: word, mode: "insensitive" as const } }));
}

export async function searchStudents(
  schoolId: string,
  academicYearId: string | null,
  { q, classId, includeInactive }: { q?: string; classId?: string; includeInactive?: boolean },
) {
  const where: Prisma.StudentWhereInput = { schoolId };
  if (!includeInactive) where.isActive = true;
  const words = wordsOf(q);
  if (words.length) where.AND = words.map((w) => ({ OR: matchAny(["firstName", "lastName", "firstNameAr", "lastNameAr", "studentNumber"], w) }));
  if (classId && academicYearId) {
    where.enrollments = { some: { schoolId, academicYearId, classGroupId: classId, status: "ACTIVE" } };
  }

  return db.student.findMany({
    where,
    include: {
      enrollments: {
        where: { schoolId, academicYearId: academicYearId ?? "__aucune__" },
        include: { classGroup: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
  });
}

export function getStudent(schoolId: string, id: string, academicYearId: string | null) {
  return db.student.findFirst({
    where: { schoolId, id },
    include: {
      enrollments: {
        where: { schoolId, academicYearId: academicYearId ?? "__aucune__" },
        include: { classGroup: { include: { gradeLevel: true } } },
      },
      guardians: {
        include: { guardian: { include: { user: { select: { id: true, email: true, phone: true } } } } },
        orderBy: [{ isPrimary: "desc" }],
      },
    },
  });
}

/**
 * Matricule automatique : "AAAA-NNN" (année de rentrée + numéro d'ordre).
 */
export async function nextStudentNumber(schoolId: string, yearPrefix: string) {
  const existing = await db.student.findMany({
    where: { schoolId, studentNumber: { startsWith: `${yearPrefix}-` } },
    select: { studentNumber: true },
  });
  const max = existing.reduce((m, s) => {
    const n = Number(s.studentNumber.slice(yearPrefix.length + 1));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${yearPrefix}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Recherche rapide (barre du haut) : élèves, parents et classes de l'année.
 * `classIds` limite aux classes d'un enseignant (null = toute l'école).
 */
export async function quickSearch(schoolId: string, academicYearId: string | null, q: string, classIds: string[] | null, withGuardians: boolean) {
  const words = wordsOf(q);
  if (words.length === 0 || q.trim().length < 2) return { students: [], guardians: [], classes: [] };
  const inScope = classIds ? { enrollments: { some: { classGroupId: { in: classIds }, status: "ACTIVE" as const } } } : {};
  const digits = q.replace(/[^\d]/g, "");
  const [students, guardians, classes] = await Promise.all([
    db.student.findMany({
      where: { schoolId, isActive: true, ...inScope, AND: words.map((w) => ({ OR: matchAny(["firstName", "lastName", "firstNameAr", "lastNameAr", "studentNumber"], w) })) },
      include: { enrollments: { where: { academicYearId: academicYearId ?? "__aucune__" }, include: { classGroup: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 20,
    }),
    withGuardians
      ? db.guardian.findMany({
          where: {
            schoolId,
            OR: [
              { AND: words.map((w) => ({ OR: matchAny(["firstName", "lastName", "firstNameAr", "lastNameAr"], w) })) },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
              { email: { contains: q.trim(), mode: "insensitive" as const } },
            ],
          },
          include: { students: { include: { student: true } } },
          take: 10,
        })
      : Promise.resolve([]),
    db.classGroup.findMany({
      where: {
        schoolId,
        academicYearId: academicYearId ?? "__aucune__",
        ...(classIds ? { id: { in: classIds } } : {}),
        OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { nameAr: { contains: q.trim(), mode: "insensitive" } }],
      },
      include: { gradeLevel: true },
      take: 10,
    }),
  ]);
  return { students, guardians, classes };
}
