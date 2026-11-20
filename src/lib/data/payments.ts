import "server-only";
import type { Fee, StudentFee } from "@prisma/client";
import { db } from "@/lib/db";
import { toISODate } from "@/lib/dates";
import { computeAccount, type Account } from "@/lib/payments";

/** Les frais qui s'appliquent à un élève, avec le montant qu'il doit. */
function chargesFor(fees: Fee[], studentFees: StudentFee[], gradeLevelId: string) {
  const byFee = new Map(studentFees.map((sf) => [sf.feeId, sf]));
  return fees
    .filter((f) => f.gradeLevelId == null || f.gradeLevelId === gradeLevelId)
    .filter((f) => !f.isOptional || byFee.has(f.id))
    .map((f) => ({ fee: f, amount: byFee.get(f.id)?.amountMillimes ?? f.amountMillimes, custom: byFee.get(f.id) ?? null }));
}

export function listFees(schoolId: string, academicYearId: string) {
  return db.fee.findMany({
    where: { schoolId, academicYearId },
    include: { gradeLevel: true, _count: { select: { students: true } } },
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
  });
}

/** Compte d'un élève pour l'année : frais, paiements, solde, retard. */
export async function getStudentAccount(schoolId: string, studentId: string, academicYearId: string, today: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { schoolId, studentId, academicYearId },
    include: { classGroup: true },
  });
  if (!enrollment) return null;
  const [fees, studentFees, payments, reminders] = await Promise.all([
    db.fee.findMany({ where: { schoolId, academicYearId }, orderBy: { dueDate: "asc" } }),
    db.studentFee.findMany({ where: { schoolId, studentId, fee: { academicYearId } } }),
    db.payment.findMany({ where: { schoolId, studentId, academicYearId }, orderBy: [{ paidAt: "desc" }, { receiptNumber: "desc" }] }),
    db.paymentReminder.findMany({ where: { schoolId, studentId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const charges = chargesFor(fees, studentFees, enrollment.classGroup.gradeLevelId);
  const paid = payments.filter((p) => !p.cancelledAt).reduce((s, p) => s + p.amountMillimes, 0);
  const account = computeAccount(
    charges.map((c) => ({ id: c.fee.id, amount: c.amount, dueDate: toISODate(c.fee.dueDate) })),
    paid,
    today,
  );
  const feeById = new Map(fees.map((f) => [f.id, f]));
  const customById = new Map(charges.map((c) => [c.fee.id, c.custom]));
  return {
    enrollment,
    account,
    lines: account.lines.map((l) => ({ ...l, fee: feeById.get(l.id)!, custom: customById.get(l.id) ?? null })),
    /** Frais optionnels du niveau auxquels l'élève n'est pas inscrit. */
    optionalAvailable: fees.filter(
      (f) => f.isOptional && (f.gradeLevelId == null || f.gradeLevelId === enrollment.classGroup.gradeLevelId) && !studentFees.some((sf) => sf.feeId === f.id),
    ),
    payments,
    reminders,
  };
}

export type StudentAccountRow = {
  studentId: string;
  student: { id: string; firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null; studentNumber: string };
  classGroup: { id: string; name: string; nameAr: string | null };
  account: Account;
  lastReminder: Date | null;
};

/** Comptes de tous les élèves inscrits cette année (pour le suivi des impayés). */
export async function getSchoolAccounts(schoolId: string, academicYearId: string, today: string): Promise<StudentAccountRow[]> {
  const [enrollments, fees, studentFees, paidByStudent, reminders] = await Promise.all([
    db.enrollment.findMany({
      where: { schoolId, academicYearId, status: "ACTIVE" },
      include: { student: true, classGroup: true },
    }),
    db.fee.findMany({ where: { schoolId, academicYearId } }),
    db.studentFee.findMany({ where: { schoolId, fee: { academicYearId } } }),
    db.payment.groupBy({ by: ["studentId"], where: { schoolId, academicYearId, cancelledAt: null }, _sum: { amountMillimes: true } }),
    db.paymentReminder.groupBy({ by: ["studentId"], where: { schoolId }, _max: { createdAt: true } }),
  ]);
  const paid = new Map(paidByStudent.map((p) => [p.studentId, p._sum.amountMillimes ?? 0]));
  const lastReminder = new Map(reminders.map((r) => [r.studentId, r._max.createdAt]));
  const sfByStudent = new Map<string, StudentFee[]>();
  for (const sf of studentFees) sfByStudent.set(sf.studentId, [...(sfByStudent.get(sf.studentId) ?? []), sf]);

  return enrollments.map((e) => {
    const charges = chargesFor(fees, sfByStudent.get(e.studentId) ?? [], e.classGroup.gradeLevelId);
    return {
      studentId: e.studentId,
      student: e.student,
      classGroup: e.classGroup,
      account: computeAccount(
        charges.map((c) => ({ id: c.fee.id, amount: c.amount, dueDate: toISODate(c.fee.dueDate) })),
        paid.get(e.studentId) ?? 0,
        today,
      ),
      lastReminder: lastReminder.get(e.studentId) ?? null,
    };
  });
}

/** Contact principal (ou à défaut le premier) pour les relances. */
export async function getPrimaryGuardian(schoolId: string, studentId: string) {
  const links = await db.studentGuardian.findMany({
    where: { studentId, guardian: { schoolId } },
    include: { guardian: true },
    orderBy: { isPrimary: "desc" },
  });
  return links[0]?.guardian ?? null;
}
