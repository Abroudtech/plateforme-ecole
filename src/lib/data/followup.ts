import "server-only";
import { parseISODate, todayISO, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { round2 } from "@/lib/grades/compute";
import { computeClassReport, getTerms, pickTerm } from "./grades";
import { getSchoolAccounts } from "./payments";
import { getCurrentYear } from "./school";

/** Seuils des alertes « élèves à suivre ». */
export const FOLLOWUP = {
  /** Moyenne générale du trimestre en dessous de… */
  lowAverage: 10,
  /** Baisse d'au moins … points par rapport au trimestre précédent. */
  drop: 2,
  /** Nombre minimum de notes dans la classe avant d'alerter sur la moyenne. */
  minAssessments: 3,
  /** Absences non justifiées sur 30 jours. */
  absences: 4,
  /** Somme due depuis plus de … jours. */
  unpaidDays: 30,
} as const;

export type FollowupReason =
  | { kind: "low"; average: number }
  | { kind: "drop"; from: number; to: number }
  | { kind: "absent"; count: number }
  | { kind: "unpaid"; amount: number };

type Row = {
  student: { id: string; firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null };
  cls: { id: string; name: string; nameAr: string | null };
  reasons: FollowupReason[];
};

/**
 * Élèves qui méritent l'attention : moyenne faible ou en baisse, absences
 * répétées, impayés anciens (ce dernier point pour la direction seulement).
 * `classIds` = null pour toute l'école.
 */
export async function studentsToFollow(schoolId: string, classIds: string[] | null, opts: { money: boolean }) {
  const year = await getCurrentYear(schoolId);
  if (!year) return [];
  const today = todayISO();
  const todayDate = parseISODate(today)!;
  const since = new Date(todayDate.getTime() - 30 * 86_400_000);
  const rows = new Map<string, Row>();
  const add = (student: Row["student"], cls: Row["cls"], reason: FollowupReason) => {
    const r = rows.get(student.id) ?? { student, cls, reasons: [] };
    r.reasons.push(reason);
    rows.set(student.id, r);
  };

  const classes = await db.classGroup.findMany({
    where: { schoolId, academicYearId: year.id, ...(classIds ? { id: { in: classIds } } : {}) },
    include: { gradeLevel: true },
  });

  // Notes : trimestre en cours, comparé au précédent.
  for (const c of classes) {
    const terms = await getTerms(schoolId, c.academicYearId, c.gradeLevel.cycle);
    const term = pickTerm(terms);
    if (!term) continue;
    const report = await computeClassReport(schoolId, c.id, term.id);
    if (!report || report.assessmentCount < FOLLOWUP.minAssessments) continue;
    const idx = terms.findIndex((t) => t.id === term.id);
    const prev = idx > 0 ? await computeClassReport(schoolId, c.id, terms[idx - 1].id) : null;
    for (const s of report.students) {
      const g = report.generals.get(s.id);
      if (g == null) continue;
      const now = round2(g);
      const before = prev?.generals.get(s.id);
      if (before != null && round2(before) - now >= FOLLOWUP.drop) add(s, c, { kind: "drop", from: round2(before), to: now });
      else if (now < FOLLOWUP.lowAverage) add(s, c, { kind: "low", average: now });
    }
  }

  // Absences non justifiées sur 30 jours.
  const absences = await db.attendanceRecord.groupBy({
    by: ["studentId", "classGroupId"],
    where: { schoolId, date: { gte: since }, status: "ABSENT", justified: false, classGroupId: { in: classes.map((c) => c.id) } },
    _count: true,
  });
  const byClass = new Map(classes.map((c) => [c.id, c]));
  const heavy = absences.filter((a) => a._count >= FOLLOWUP.absences);
  if (heavy.length > 0) {
    const students = await db.student.findMany({ where: { id: { in: heavy.map((a) => a.studentId) } } });
    const byId = new Map(students.map((s) => [s.id, s]));
    for (const a of heavy) {
      const s = byId.get(a.studentId);
      const c = byClass.get(a.classGroupId);
      if (s && c) add(s, c, { kind: "absent", count: a._count });
    }
  }

  // Impayés : ce qui était dû il y a plus de 30 jours et n'est toujours pas réglé.
  if (opts.money) {
    const past = toISODate(new Date(todayDate.getTime() - FOLLOWUP.unpaidDays * 86_400_000));
    for (const a of await getSchoolAccounts(schoolId, year.id, past)) {
      if (a.account.overdue <= 0) continue;
      const c = byClass.get(a.classGroup.id);
      if (c) add(a.student, c, { kind: "unpaid", amount: a.account.overdue });
    }
  }

  // Les plus de raisons d'abord.
  return [...rows.values()].sort((a, b) => b.reasons.length - a.reasons.length || a.cls.name.localeCompare(b.cls.name) || a.student.lastName.localeCompare(b.student.lastName));
}
