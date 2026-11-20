import type { Cycle, PrismaClient } from "@prisma/client";
import { applyDefaultCurriculum } from "./curriculum";
import { GRADE_LEVELS, SUBJECTS, TRACKS, TRIMESTERS } from "./tunisia";

/** Dates habituelles des trimestres en Tunisie, pour une année "2026-2027". */
export function trimesterDates(label: string) {
  const start = Number(label.slice(0, 4));
  const d = (y: number, md: string) => new Date(`${y}-${md}T00:00:00Z`);
  return [
    { startDate: d(start, "09-15"), endDate: d(start, "12-31") },
    { startDate: d(start + 1, "01-01"), endDate: d(start + 1, "03-31") },
    { startDate: d(start + 1, "04-01"), endDate: d(start + 1, "06-30") },
  ];
}

/**
 * Prépare une nouvelle école : niveaux, filières et matières tunisiennes,
 * année scolaire en cours et ses trois trimestres. Sans données de démonstration.
 */
export async function bootstrapSchool(
  db: PrismaClient,
  input: { slug: string; nameFr: string; nameAr: string; city: string | null; cycles: Cycle[]; yearLabel: string },
) {
  const school = await db.school.create({
    data: { slug: input.slug, nameFr: input.nameFr, nameAr: input.nameAr, city: input.city, cycles: input.cycles },
  });
  const schoolId = school.id;
  const levels = GRADE_LEVELS.filter((l) => input.cycles.includes(l.cycle));
  await db.gradeLevel.createMany({ data: levels.map((l) => ({ schoolId, ...l })) });
  if (input.cycles.includes("SECONDARY")) await db.track.createMany({ data: TRACKS.map((t) => ({ schoolId, ...t })) });
  await db.subject.createMany({ data: SUBJECTS.map((s) => ({ schoolId, ...s })) });

  const dates = trimesterDates(input.yearLabel);
  const year = await db.academicYear.create({
    data: { schoolId, label: input.yearLabel, startDate: dates[0].startDate, endDate: dates[2].endDate, isCurrent: true },
  });
  await db.term.createMany({ data: TRIMESTERS.map((t, i) => ({ schoolId, academicYearId: year.id, ...t, ...dates[i] })) });

  // Programme par défaut de chaque niveau (et de chaque filière au lycée).
  const created = await db.gradeLevel.findMany({ where: { schoolId } });
  const tracks = await db.track.findMany({ where: { schoolId } });
  for (const level of created) {
    if (level.cycle === "SECONDARY" && level.rank >= 12) {
      for (const t of tracks) await applyDefaultCurriculum(db, schoolId, level.id, t.id);
    } else {
      await applyDefaultCurriculum(db, schoolId, level.id, null);
    }
  }
  return { school, year };
}
