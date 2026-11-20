import "server-only";
import { db } from "@/lib/db";

export function listClasses(schoolId: string, academicYearId: string) {
  return db.classGroup.findMany({
    where: { schoolId, academicYearId },
    include: {
      gradeLevel: true,
      track: true,
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
  });
}

export function getClass(schoolId: string, id: string) {
  return db.classGroup.findFirst({
    where: { schoolId, id },
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
}

/** Niveaux proposés par l'école (selon ses cycles) et filières. */
export async function getLevelsAndTracks(schoolId: string, cycles: string[]) {
  const [levels, tracks] = await Promise.all([
    db.gradeLevel.findMany({
      where: { schoolId, cycle: { in: cycles as never } },
      orderBy: { rank: "asc" },
    }),
    db.track.findMany({ where: { schoolId }, orderBy: { nameFr: "asc" } }),
  ]);
  return { levels, tracks };
}
