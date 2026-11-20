import type { PrismaClient } from "@prisma/client";
import { defaultCurriculum } from "./tunisia";

/**
 * Remplit le programme (matières + coefficients) d'un niveau / d'une filière
 * avec les valeurs par défaut, sans toucher à ce qui existe déjà.
 */
export async function applyDefaultCurriculum(
  db: PrismaClient,
  schoolId: string,
  gradeLevelId: string,
  trackId: string | null,
) {
  const level = await db.gradeLevel.findFirstOrThrow({ where: { id: gradeLevelId, schoolId } });
  const track = trackId ? await db.track.findFirst({ where: { id: trackId, schoolId } }) : null;
  const defaults = defaultCurriculum(level.code, track?.code ?? null);
  const subjects = await db.subject.findMany({ where: { schoolId, code: { in: Object.keys(defaults) } } });
  const existing = await db.curriculumSubject.findMany({ where: { schoolId, gradeLevelId, trackId } });
  const have = new Set(existing.map((e) => e.subjectId));
  const data = subjects
    .filter((s) => !have.has(s.id))
    .map((s) => ({ schoolId, gradeLevelId, trackId, subjectId: s.id, coefficient: defaults[s.code] }));
  if (data.length) await db.curriculumSubject.createMany({ data });
  return data.length;
}
