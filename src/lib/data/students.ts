import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function searchStudents(
  schoolId: string,
  academicYearId: string | null,
  { q, classId, includeInactive }: { q?: string; classId?: string; includeInactive?: boolean },
) {
  const where: Prisma.StudentWhereInput = { schoolId };
  if (!includeInactive) where.isActive = true;
  const term = q?.trim();
  if (term) {
    where.OR = ["firstName", "lastName", "firstNameAr", "lastNameAr", "studentNumber"].map((field) => ({
      [field]: { contains: term, mode: "insensitive" },
    }));
  }
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
