import "server-only";
import { db } from "@/lib/db";
import { plusOneYear, proposeDestination, type Destination, type NextClass } from "@/lib/rollover";
import { computeClassAnnual } from "./annual";
import { getCurrentYear } from "./school";

/** Année suivante déjà préparée (pas encore en cours), s'il y en a une. */
export async function getNextYear(schoolId: string) {
  const current = await getCurrentYear(schoolId);
  if (!current) return null;
  return db.academicYear.findFirst({
    where: { schoolId, isCurrent: false, startDate: { gt: current.startDate } },
    orderBy: { startDate: "asc" },
  });
}

/**
 * Prépare l'année suivante à partir de l'année en cours : trimestres (dates
 * décalées d'un an), mêmes classes, frais de l'année ; en option, mêmes
 * enseignants par classe, mêmes emplois du temps, réductions des élèves.
 * L'année en cours n'est pas modifiée.
 */
export async function prepareNextYear(
  schoolId: string,
  label: string,
  opts: { teachers: boolean; timetable: boolean; discounts: boolean },
) {
  const current = await getCurrentYear(schoolId);
  if (!current) throw new Error("noYear");
  const [terms, classes, fees] = await Promise.all([
    db.term.findMany({ where: { schoolId, academicYearId: current.id } }),
    db.classGroup.findMany({
      where: { schoolId, academicYearId: current.id },
      include: {
        teacherAssignments: true,
        timetable: true,
        evaluationSchemes: { include: { items: true } },
      },
    }),
    db.fee.findMany({ where: { schoolId, academicYearId: current.id }, include: { students: true } }),
  ]);

  return db.$transaction(
    async (tx) => {
      const year = await tx.academicYear.create({
        data: { schoolId, label, startDate: plusOneYear(current.startDate), endDate: plusOneYear(current.endDate), isCurrent: false },
      });
      await tx.term.createMany({
        data: terms.map(({ id: _id, academicYearId: _y, startDate, endDate, ...t }) => ({
          ...t,
          academicYearId: year.id,
          startDate: startDate ? plusOneYear(startDate) : null,
          endDate: endDate ? plusOneYear(endDate) : null,
        })),
      });
      for (const c of classes) {
        const created = await tx.classGroup.create({
          data: { schoolId, academicYearId: year.id, gradeLevelId: c.gradeLevelId, trackId: c.trackId, name: c.name, nameAr: c.nameAr, capacity: c.capacity },
        });
        if (opts.teachers && c.teacherAssignments.length) {
          await tx.teacherAssignment.createMany({ data: c.teacherAssignments.map((a) => ({ schoolId, teacherId: a.teacherId, classGroupId: created.id })) });
        }
        if (opts.timetable && c.timetable.length) {
          await tx.timetableEntry.createMany({
            data: c.timetable.map(({ id: _id, classGroupId: _c, ...e }) => ({ ...e, classGroupId: created.id })),
          });
        }
        // Structure des notes propre à la classe (oral, contrôle, synthèse...).
        for (const sch of c.evaluationSchemes) {
          await tx.evaluationScheme.create({
            data: {
              schoolId,
              classGroupId: created.id,
              subjectId: sch.subjectId,
              items: { create: sch.items.map((i) => ({ kind: i.kind, weight: i.weight })) },
            },
          });
        }
      }
      for (const f of fees) {
        const nf = await tx.fee.create({
          data: {
            schoolId,
            academicYearId: year.id,
            gradeLevelId: f.gradeLevelId,
            name: f.name,
            nameAr: f.nameAr,
            amountMillimes: f.amountMillimes,
            dueDate: plusOneYear(f.dueDate),
            isOptional: f.isOptional,
          },
        });
        if (opts.discounts && f.students.length) {
          await tx.studentFee.createMany({
            data: f.students.map((sf) => ({ schoolId, studentId: sf.studentId, feeId: nf.id, amountMillimes: sf.amountMillimes, note: sf.note })),
          });
        }
      }
      return year;
    },
    { timeout: 60_000 },
  );
}

async function nextClassesOf(schoolId: string, nextYearId: string): Promise<(NextClass & { nameAr: string | null })[]> {
  const list = await db.classGroup.findMany({ where: { schoolId, academicYearId: nextYearId }, include: { gradeLevel: true } });
  return list.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr, rank: c.gradeLevel.rank, trackId: c.trackId }));
}

async function maxRankOf(schoolId: string) {
  const top = await db.gradeLevel.findFirst({ where: { schoolId }, orderBy: { rank: "desc" } });
  return top?.rank ?? 13;
}

/** Tableau de passage d'une classe : décision de l'année et classe proposée l'an prochain. */
export async function getPromotionPlan(schoolId: string, classId: string, nextYearId: string) {
  const cls = await db.classGroup.findFirst({
    where: { schoolId, id: classId },
    include: {
      gradeLevel: true,
      enrollments: {
        where: { status: "ACTIVE" },
        include: { student: true },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      },
    },
  });
  if (!cls) return null;
  const [annual, next, maxRank, placed] = await Promise.all([
    computeClassAnnual(schoolId, classId),
    nextClassesOf(schoolId, nextYearId),
    maxRankOf(schoolId),
    db.enrollment.findMany({ where: { schoolId, academicYearId: nextYearId, studentId: { in: cls.enrollments.map((e) => e.studentId) } } }),
  ]);
  const placedBy = new Map(placed.map((p) => [p.studentId, p.classGroupId]));
  const from = { name: cls.name, rank: cls.gradeLevel.rank, trackId: cls.trackId };
  const rows = cls.enrollments.map((e) => {
    const decision = annual?.decisions.get(e.studentId) ?? "PENDING";
    const saved: Destination = placedBy.get(e.studentId) ?? (e.nextStep === "LEAVE" ? "LEAVE" : null);
    return {
      student: e.student,
      average: annual?.annual.get(e.studentId)?.average ?? null,
      decision,
      saved,
      // Décision pas encore connue : on propose le niveau suivant, à vérifier.
      proposed: saved ?? proposeDestination(from, decision === "PENDING" ? "PASS" : decision, next, maxRank),
      toCheck: !saved && decision === "PENDING",
    };
  });
  return { cls, rows, next };
}

/** Enregistre les choix d'une classe : classe de l'an prochain, ou départ de l'école. */
export async function savePromotion(schoolId: string, classId: string, nextYearId: string, choices: Map<string, string>) {
  const cls = await db.classGroup.findFirst({ where: { schoolId, id: classId }, include: { enrollments: { where: { status: "ACTIVE" } } } });
  if (!cls) throw new Error("notFound");
  const valid = new Set((await db.classGroup.findMany({ where: { schoolId, academicYearId: nextYearId }, select: { id: true } })).map((c) => c.id));
  await db.$transaction(async (tx) => {
    for (const e of cls.enrollments) {
      const choice = choices.get(e.studentId) ?? "";
      const where = { studentId_academicYearId: { studentId: e.studentId, academicYearId: nextYearId } };
      if (valid.has(choice)) {
        await tx.enrollment.upsert({
          where,
          update: { classGroupId: choice, status: "ACTIVE" },
          create: { schoolId, studentId: e.studentId, academicYearId: nextYearId, classGroupId: choice },
        });
        await tx.enrollment.update({ where: { id: e.id }, data: { nextStep: null } });
      } else {
        await tx.enrollment.deleteMany({ where: { schoolId, studentId: e.studentId, academicYearId: nextYearId } });
        await tx.enrollment.update({ where: { id: e.id }, data: { nextStep: choice === "LEAVE" ? "LEAVE" : null } });
      }
    }
  });
}

/** Où en est le passage : élèves placés, départs, élèves sans classe l'an prochain. */
export async function getRolloverSummary(schoolId: string, currentYearId: string, nextYearId: string) {
  const [current, placed, leaving, classes] = await Promise.all([
    db.enrollment.findMany({ where: { schoolId, academicYearId: currentYearId, status: "ACTIVE" }, select: { studentId: true, classGroupId: true } }),
    db.enrollment.findMany({ where: { schoolId, academicYearId: nextYearId }, select: { studentId: true } }),
    db.enrollment.count({ where: { schoolId, academicYearId: currentYearId, status: "ACTIVE", nextStep: "LEAVE" } }),
    db.classGroup.findMany({
      where: { schoolId, academicYearId: currentYearId },
      include: { gradeLevel: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
    }),
  ]);
  const placedSet = new Set(placed.map((p) => p.studentId));
  const doneByClass = new Map<string, number>();
  for (const e of current) {
    if (placedSet.has(e.studentId)) doneByClass.set(e.classGroupId, (doneByClass.get(e.classGroupId) ?? 0) + 1);
  }
  return {
    total: current.length,
    placed: current.filter((e) => placedSet.has(e.studentId)).length,
    newOnly: placed.filter((p) => !current.some((e) => e.studentId === p.studentId)).length,
    leaving,
    classes: classes.map((c) => ({ ...c, placed: doneByClass.get(c.id) ?? 0 })),
  };
}

/**
 * Bascule sur l'année suivante : elle devient l'année en cours. Les élèves
 * marqués « quitte l'école » sont retirés des listes (historique conservé).
 */
export async function switchToNextYear(schoolId: string, currentYearId: string, nextYearId: string) {
  const leaving = await db.enrollment.findMany({ where: { schoolId, academicYearId: currentYearId, status: "ACTIVE", nextStep: "LEAVE" } });
  await db.$transaction([
    db.academicYear.update({ where: { id: currentYearId }, data: { isCurrent: false } }),
    db.academicYear.update({ where: { id: nextYearId }, data: { isCurrent: true } }),
    db.enrollment.updateMany({ where: { id: { in: leaving.map((e) => e.id) } }, data: { status: "GRADUATED" } }),
    db.student.updateMany({ where: { schoolId, id: { in: leaving.map((e) => e.studentId) } }, data: { isActive: false } }),
  ]);
}

/** Annule une bascule faite par erreur : l'année précédente redevient l'année en cours. */
export async function switchBack(schoolId: string, currentYearId: string, previousYearId: string) {
  const left = await db.enrollment.findMany({ where: { schoolId, academicYearId: previousYearId, status: "GRADUATED", nextStep: "LEAVE" } });
  await db.$transaction([
    db.academicYear.update({ where: { id: currentYearId }, data: { isCurrent: false } }),
    db.academicYear.update({ where: { id: previousYearId }, data: { isCurrent: true } }),
    db.enrollment.updateMany({ where: { id: { in: left.map((e) => e.id) } }, data: { status: "ACTIVE" } }),
    db.student.updateMany({ where: { schoolId, id: { in: left.map((e) => e.studentId) } }, data: { isActive: true } }),
  ]);
}
