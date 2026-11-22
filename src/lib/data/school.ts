import "server-only";
import { db } from "@/lib/db";

// Toutes les fonctions de ce dossier prennent `schoolId` en premier
// paramètre : impossible d'oublier le filtre par établissement.

export function getCurrentYear(schoolId: string) {
  return db.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    orderBy: { startDate: "desc" },
  });
}

/** Chiffres clés et classes de l'année, pour le tableau de bord de la direction. */
export async function getAdminOverview(schoolId: string) {
  const year = await getCurrentYear(schoolId);

  const [studentCount, levelCount, classes] = await Promise.all([
    db.student.count({ where: { schoolId, isActive: true } }),
    db.gradeLevel.count({ where: { schoolId } }),
    year
      ? db.classGroup.findMany({
          where: { schoolId, academicYearId: year.id },
          include: {
            gradeLevel: true,
            track: true,
            _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
          },
          orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return { year, studentCount, levelCount, classes };
}

/** Enfants reliés au compte parent, avec leur classe de l'année en cours. */
export async function getParentChildren(schoolId: string, userId: string) {
  const year = await getCurrentYear(schoolId);
  const links = await db.studentGuardian.findMany({
    where: { guardian: { schoolId, userId }, student: { schoolId, isActive: true } },
    include: {
      student: {
        include: {
          enrollments: {
            where: { schoolId, academicYearId: year?.id ?? "__aucune__" },
            include: { classGroup: { include: { gradeLevel: true } } },
          },
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });
  return links.map((l) => ({ ...l.student, relationship: l.relationship }));
}

/** Demandes « mot de passe oublié » en attente, pour les comptes de cette école. */
export function pendingResetRequests(schoolId: string) {
  return db.passwordReset.findMany({
    where: { kind: "SCHOOL", usedAt: null, expiresAt: { gt: new Date() }, user: { memberships: { some: { schoolId, isActive: true } } } },
    include: { user: { include: { memberships: { where: { schoolId, isActive: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}
