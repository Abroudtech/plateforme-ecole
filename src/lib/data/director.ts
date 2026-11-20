import "server-only";
import { db } from "@/lib/db";
import { parseISODate, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/grades/compute";
import { computeClassReport, getTerms, pickTerm } from "./grades";
import { countUnread } from "./messages";
import { getSchoolAccounts } from "./payments";
import { getCurrentYear } from "./school";

/**
 * Tout ce que le directeur doit voir d'un coup d'œil : la journée, les choses
 * à faire, les résultats du trimestre, les absences et l'argent encaissé.
 */
export async function getDirectorOverview(schoolId: string, userId: string) {
  const year = await getCurrentYear(schoolId);
  const today = todayISO();
  const todayDate = parseISODate(today)!;
  const since = new Date(todayDate.getTime() - 30 * 86_400_000);
  const monthStart = parseISODate(`${today.slice(0, 7)}-01`)!;

  const [studentCount, classes, rollCallsToday, absencesToday, records30, unread, accounts, collectedMonth, collectedYear] = await Promise.all([
    db.student.count({ where: { schoolId, isActive: true } }),
    year
      ? db.classGroup.findMany({
          where: { schoolId, academicYearId: year.id },
          include: { gradeLevel: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
          orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
    db.rollCall.findMany({ where: { schoolId, date: todayDate }, select: { classGroupId: true } }),
    db.attendanceRecord.groupBy({ by: ["status"], where: { schoolId, date: todayDate }, _count: true }),
    db.attendanceRecord.findMany({
      where: { schoolId, date: { gte: since }, status: "ABSENT" },
      select: { studentId: true, justified: true, student: true, classGroup: { select: { name: true, nameAr: true } } },
    }),
    countUnread(schoolId, userId, null),
    year ? getSchoolAccounts(schoolId, year.id, today) : Promise.resolve([]),
    db.payment.aggregate({ where: { schoolId, cancelledAt: null, paidAt: { gte: monthStart } }, _sum: { amountMillimes: true } }),
    year
      ? db.payment.aggregate({ where: { schoolId, cancelledAt: null, academicYearId: year.id }, _sum: { amountMillimes: true } })
      : Promise.resolve({ _sum: { amountMillimes: 0 } }),
  ]);

  const activeClasses = classes.filter((c) => c._count.enrollments > 0);
  const rolled = new Set(rollCallsToday.map((r) => r.classGroupId));
  const isSchoolDay = todayDate.getUTCDay() !== 0; // pas d'appel attendu le dimanche
  const classesWithoutRollCall = isSchoolDay ? activeClasses.filter((c) => !rolled.has(c.id)) : [];

  // Résultats du trimestre en cours, classe par classe.
  const results = [];
  let currentTerm: { id: string; nameFr: string; nameAr: string } | null = null;
  const unpublished: typeof activeClasses = [];
  for (const c of activeClasses) {
    const terms = await getTerms(schoolId, c.academicYearId, c.gradeLevel.cycle);
    const term = pickTerm(terms);
    if (!term) continue;
    currentTerm ??= term;
    const report = await computeClassReport(schoolId, c.id, term.id);
    if (!report) continue;
    if (!report.publication) unpublished.push(c);
    if (report.assessmentCount === 0 || !report.classStats) continue;
    const below = [...report.generals.values()].filter((g) => g != null && round2(g) < 10).length;
    results.push({ cls: c, term, mean: report.classStats.mean, below, count: report.students.length });
  }

  // Élèves les plus absents sur 30 jours.
  const byStudent = new Map<string, { student: (typeof records30)[number]["student"]; cls: (typeof records30)[number]["classGroup"]; total: number; unjustified: number }>();
  for (const r of records30) {
    const e = byStudent.get(r.studentId) ?? { student: r.student, cls: r.classGroup, total: 0, unjustified: 0 };
    e.total += 1;
    if (!r.justified) e.unjustified += 1;
    byStudent.set(r.studentId, e);
  }
  const mostAbsent = [...byStudent.values()].sort((a, b) => b.unjustified - a.unjustified || b.total - a.total).slice(0, 5);

  const due = accounts.reduce((s, a) => s + a.account.totalDue, 0);
  const paid = accounts.reduce((s, a) => s + Math.min(a.account.totalPaid, a.account.totalDue), 0);
  const dueToDate = accounts.reduce((s, a) => s + a.account.lines.filter((l) => l.dueDate <= today).reduce((x, l) => x + l.amount, 0), 0);
  const overdue = accounts.reduce((s, a) => s + a.account.overdue, 0);

  return {
    year,
    today,
    studentCount,
    classCount: activeClasses.length,
    absentToday: absencesToday.find((g) => g.status === "ABSENT")?._count ?? 0,
    lateToday: absencesToday.find((g) => g.status === "LATE")?._count ?? 0,
    rollCallsDone: activeClasses.length - classesWithoutRollCall.length,
    classesWithoutRollCall,
    isSchoolDay,
    currentTerm,
    unpublished,
    results,
    absences30: { total: records30.length, unjustified: records30.filter((r) => !r.justified).length, mostAbsent },
    unread,
    money: {
      due,
      paid,
      overdue,
      overdueCount: accounts.filter((a) => a.account.overdue > 0).length,
      /** Part de ce qui était dû à ce jour qui a été encaissé. */
      rateToDate: dueToDate > 0 ? Math.min(1, paid / dueToDate) : null,
      month: collectedMonth._sum.amountMillimes ?? 0,
      year: collectedYear._sum.amountMillimes ?? 0,
    },
  };
}
