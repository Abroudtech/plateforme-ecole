import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentYear } from "@/lib/data/school";
import type { TemplateData } from "@/lib/import/excel";
import type { Plan, Snapshot } from "@/lib/import/plan";

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Tout ce que l'école contient déjà, pour repérer les doublons. */
export async function loadSnapshot(schoolId: string): Promise<Snapshot> {
  const year = await getCurrentYear(schoolId);
  const [levels, tracks, classes, subjects, curriculum, rooms, teachers, students, guardians] = await Promise.all([
    db.gradeLevel.findMany({ where: { schoolId }, orderBy: { rank: "asc" } }),
    db.track.findMany({ where: { schoolId } }),
    year ? db.classGroup.findMany({ where: { schoolId, academicYearId: year.id } }) : Promise.resolve([]),
    db.subject.findMany({ where: { schoolId } }),
    db.curriculumSubject.findMany({ where: { schoolId } }),
    db.room.findMany({ where: { schoolId } }),
    db.teacher.findMany({ where: { schoolId } }),
    db.student.findMany({
      where: { schoolId },
      include: {
        enrollments: { where: { academicYearId: year?.id ?? "__aucune__" } },
        guardians: true,
      },
    }),
    db.guardian.findMany({ where: { schoolId } }),
  ]);
  return {
    yearId: year?.id ?? null,
    yearPrefix: year ? year.label.slice(0, 4) : String(new Date().getFullYear()),
    levels,
    tracks,
    classes,
    subjects,
    curriculum: curriculum.map((c) => ({ ...c, coefficient: Number(c.coefficient) })),
    rooms,
    teachers,
    students: students.map((s) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      birthDate: isoDate(s.birthDate),
      classId: s.enrollments[0]?.classGroupId ?? null,
      guardianIds: s.guardians.map((g) => g.guardianId),
      hasPrimary: s.guardians.some((g) => g.isPrimary),
    })),
    guardians,
    studentNumbers: students.map((s) => s.studentNumber),
  };
}

/** Écrit tout le plan d'un coup : soit tout est importé, soit rien. */
export async function applyPlan(schoolId: string, yearId: string | null, plan: Plan) {
  await db.$transaction(
    async (tx) => {
      if (plan.classes.length) {
        if (!yearId) throw new Error("Pas d'année scolaire en cours");
        await tx.classGroup.createMany({ data: plan.classes.map((c) => ({ ...c, schoolId, academicYearId: yearId })) });
      }
      if (plan.subjects.length) await tx.subject.createMany({ data: plan.subjects.map((s) => ({ ...s, schoolId })) });
      if (plan.curriculumCreate.length) {
        await tx.curriculumSubject.createMany({ data: plan.curriculumCreate.map((c) => ({ ...c, schoolId })) });
      }
      for (const u of plan.curriculumUpdate) {
        await tx.curriculumSubject.updateMany({ where: { id: u.id, schoolId }, data: { coefficient: u.coefficient } });
      }
      if (plan.rooms.length) await tx.room.createMany({ data: plan.rooms.map((r) => ({ ...r, schoolId })) });
      if (plan.teachers.length) await tx.teacher.createMany({ data: plan.teachers.map((t) => ({ ...t, schoolId })) });
      if (plan.students.length) {
        await tx.student.createMany({
          data: plan.students.map((s) => ({ ...s, schoolId, birthDate: s.birthDate ? new Date(`${s.birthDate}T00:00:00Z`) : null })),
        });
      }
      if (plan.enrollments.length) {
        if (!yearId) throw new Error("Pas d'année scolaire en cours");
        await tx.enrollment.createMany({
          data: plan.enrollments.map((e) => ({ ...e, schoolId, academicYearId: yearId })),
          skipDuplicates: true,
        });
      }
      if (plan.guardians.length) await tx.guardian.createMany({ data: plan.guardians.map((g) => ({ ...g, schoolId })) });
      if (plan.links.length) await tx.studentGuardian.createMany({ data: plan.links, skipDuplicates: true });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

/** Identifiant des nouvelles lignes. */
export const newId = () => randomUUID();

/** Contenu du modèle Excel : niveaux de l'école et lignes déjà connues. */
export async function templateData(schoolId: string, lang: "fr" | "ar"): Promise<TemplateData> {
  const snap = await loadSnapshot(schoolId);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const levelName = new Map(snap.levels.map((l) => [l.id, l.nameFr]));
  const trackName = new Map(snap.tracks.map((t) => [t.id, t.nameFr]));
  const subjectName = new Map(snap.subjects.map((s) => [s.id, s]));
  const rank = new Map(snap.levels.map((l, i) => [l.id, i]));
  const classes = await db.classGroup.findMany({ where: { schoolId, academicYearId: snap.yearId ?? "__aucune__" } });
  const teachers = await db.teacher.findMany({ where: { schoolId, isActive: true }, orderBy: [{ lastName: "asc" }] });
  const rooms = await db.room.findMany({ where: { schoolId }, orderBy: { name: "asc" } });

  return {
    schoolName: lang === "ar" ? school.nameAr : school.nameFr,
    levels: snap.levels.map((l) => l.nameFr),
    tracks: snap.tracks.map((t) => t.nameFr),
    prefill: {
      classes: classes
        .sort((a, b) => (rank.get(a.gradeLevelId) ?? 0) - (rank.get(b.gradeLevelId) ?? 0) || a.name.localeCompare(b.name))
        .map((c) => [c.name, c.nameAr, levelName.get(c.gradeLevelId) ?? "", c.trackId ? (trackName.get(c.trackId) ?? "") : null, c.capacity]),
      subjects: [...snap.curriculum]
        .sort((a, b) => (rank.get(a.gradeLevelId) ?? 0) - (rank.get(b.gradeLevelId) ?? 0) || b.coefficient - a.coefficient)
        .map((c) => {
          const s = subjectName.get(c.subjectId);
          return [levelName.get(c.gradeLevelId) ?? "", s?.nameFr ?? "", s?.nameAr ?? "", c.coefficient, c.trackId ? (trackName.get(c.trackId) ?? "") : null];
        }),
      rooms: rooms.map((r) => [r.name, r.capacity]),
      teachers: teachers.map((t) => [t.lastName, t.firstName, t.lastNameAr, t.firstNameAr, t.phone?.replace(/^\+216/, "") ?? null, t.email]),
    },
  };
}
