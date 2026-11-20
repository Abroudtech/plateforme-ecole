import "server-only";
import type { DayPeriod } from "@prisma/client";
import { db } from "@/lib/db";

export function getRollCall(schoolId: string, classGroupId: string, date: Date, period: DayPeriod) {
  return Promise.all([
    db.rollCall.findUnique({ where: { classGroupId_date_period: { classGroupId, date, period } } }),
    db.attendanceRecord.findMany({ where: { schoolId, classGroupId, date, period } }),
  ]).then(([rollCall, records]) => ({ rollCall, records: new Map(records.map((r) => [r.studentId, r])) }));
}

/** Absences et retards de toute l'école pour une date, et classes sans appel. */
export async function getDayOverview(schoolId: string, academicYearId: string | null, date: Date) {
  const [records, classes, rollCalls] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { schoolId, date },
      include: { student: true, classGroup: true },
      orderBy: [{ classGroup: { name: "asc" } }, { period: "asc" }, { student: { lastName: "asc" } }],
    }),
    academicYearId
      ? db.classGroup.findMany({ where: { schoolId, academicYearId }, include: { gradeLevel: true }, orderBy: [{ gradeLevel: { rank: "asc" } }, { name: "asc" }] })
      : Promise.resolve([]),
    db.rollCall.findMany({ where: { schoolId, date } }),
  ]);
  const done = new Set(rollCalls.map((r) => `${r.classGroupId}:${r.period}`));
  return { records, classes, done };
}

/** Absences d'un élève (les plus récentes d'abord) et leur décompte. */
export async function getStudentAttendance(schoolId: string, studentId: string, since?: Date) {
  const records = await db.attendanceRecord.findMany({
    where: { schoolId, studentId, ...(since ? { date: { gte: since } } : {}) },
    orderBy: [{ date: "desc" }, { period: "desc" }],
  });
  return { records, summary: summarize(records) };
}

export function summarize(records: { status: string; justified: boolean }[]) {
  const absences = records.filter((r) => r.status === "ABSENT");
  return {
    absences: absences.length,
    unjustified: absences.filter((r) => !r.justified).length,
    lates: records.filter((r) => r.status === "LATE").length,
  };
}

export function countAbsences(schoolId: string, date: Date) {
  return db.attendanceRecord.count({ where: { schoolId, date, status: "ABSENT" } });
}
