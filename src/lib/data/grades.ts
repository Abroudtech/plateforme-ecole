import "server-only";
import type { Cycle } from "@prisma/client";
import { db } from "@/lib/db";
import { generalAverage, ranks, stats, subjectAverage } from "@/lib/grades/compute";

/** Trimestres de l'année valables pour un cycle. */
export function getTerms(schoolId: string, academicYearId: string, cycle: Cycle) {
  return db.term.findMany({
    where: { schoolId, academicYearId, OR: [{ cycle: null }, { cycle }] },
    orderBy: { order: "asc" },
  });
}

/** Choisit le trimestre demandé dans l'adresse, sinon le trimestre en cours, sinon le premier. */
export function pickTerm<T extends { id: string; startDate: Date | null; endDate: Date | null }>(terms: T[], requested?: string) {
  const now = new Date();
  return (
    terms.find((t) => t.id === requested) ??
    terms.find((t) => t.startDate && t.endDate && t.startDate <= now && now <= t.endDate) ??
    terms[0] ??
    null
  );
}

/** Matières (et coefficients) enseignées dans une classe, selon son niveau et sa filière. */
export function getClassCurriculum(schoolId: string, cls: { gradeLevelId: string; trackId: string | null }) {
  return db.curriculumSubject.findMany({
    where: { schoolId, gradeLevelId: cls.gradeLevelId, trackId: cls.trackId },
    include: { subject: true },
    orderBy: [{ coefficient: "desc" }, { subject: { nameFr: "asc" } }],
  });
}

export function getAssessments(schoolId: string, classGroupId: string, termId: string) {
  return db.assessment.findMany({
    where: { schoolId, classGroupId, termId },
    include: { subject: true, _count: { select: { grades: { where: { OR: [{ score: { not: null } }, { absent: true }] } } } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

export function getAssessment(schoolId: string, id: string) {
  return db.assessment.findFirst({
    where: { schoolId, id },
    include: {
      subject: true,
      term: true,
      grades: true,
      classGroup: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: { student: true },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
          },
        },
      },
    },
  });
}

/**
 * Calcule tout ce qu'il faut pour les bulletins d'une classe et d'un trimestre :
 * moyennes par matière, moyenne générale, rang, statistiques de classe.
 */
export async function computeClassReport(schoolId: string, classGroupId: string, termId: string) {
  const cls = await db.classGroup.findFirst({
    where: { schoolId, id: classGroupId },
    include: {
      gradeLevel: true,
      track: true,
      academicYear: true,
      enrollments: {
        where: { status: "ACTIVE" },
        include: { student: true },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      },
    },
  });
  if (!cls) return null;

  const [curriculum, assessments, comments, publication] = await Promise.all([
    getClassCurriculum(schoolId, cls),
    db.assessment.findMany({ where: { schoolId, classGroupId, termId }, include: { grades: true } }),
    db.termComment.findMany({ where: { schoolId, termId, studentId: { in: cls.enrollments.map((e) => e.studentId) } } }),
    db.reportCardPublication.findUnique({ where: { classGroupId_termId: { classGroupId, termId } } }),
  ]);

  const students = cls.enrollments.map((e) => e.student);

  // Moyenne de chaque élève dans chaque matière.
  const subjectRows = curriculum.map((c) => {
    const subjectAssessments = assessments.filter((a) => a.subjectId === c.subjectId);
    const averages = new Map<string, number | null>();
    for (const s of students) {
      averages.set(
        s.id,
        subjectAverage(
          subjectAssessments.map((a) => {
            const g = a.grades.find((x) => x.studentId === s.id);
            return {
              score: g?.score != null ? Number(g.score) : null,
              absent: g?.absent ?? false,
              maxScore: Number(a.maxScore),
              weight: Number(a.weight),
            };
          }),
        ),
      );
    }
    return {
      subject: c.subject,
      coefficient: Number(c.coefficient),
      averages,
      classStats: stats([...averages.values()]),
    };
  });

  const generals = new Map<string, number | null>(
    students.map((s) => [
      s.id,
      generalAverage(subjectRows.map((r) => ({ average: r.averages.get(s.id) ?? null, coefficient: r.coefficient }))),
    ]),
  );
  const rankMap = ranks(generals);

  return {
    cls,
    students,
    subjects: subjectRows,
    generals,
    ranks: rankMap,
    classStats: stats([...generals.values()]),
    comments: new Map(comments.map((c) => [c.studentId, c.comment])),
    publication,
    assessmentCount: assessments.length,
  };
}

/** Classe de l'élève pour l'année en cours (pour retrouver son bulletin). */
export function getStudentClass(schoolId: string, studentId: string, academicYearId: string) {
  return db.enrollment.findFirst({
    where: { schoolId, studentId, academicYearId },
    include: { classGroup: { include: { gradeLevel: true } } },
  });
}

/** Vrai si ce compte est parent (tuteur relié) de cet élève dans cette école. */
export async function isGuardianOf(schoolId: string, userId: string, studentId: string) {
  const link = await db.studentGuardian.findFirst({
    where: { studentId, student: { schoolId }, guardian: { schoolId, userId } },
  });
  return !!link;
}
