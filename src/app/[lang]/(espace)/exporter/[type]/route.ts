import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { getSchoolAccounts } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { parseMonth, teachingMinutes, weekdayCounts } from "@/lib/payroll";
import { buildExport, type ExportCell, type ExportColumn } from "@/lib/export/excel";
import type { Permission } from "@/lib/auth/permissions";

const TYPES: Record<string, Permission> = {
  eleves: "students.write",
  absences: "attendance.justify",
  encaissements: "payments.read",
  soldes: "payments.read",
  heures: "payments.read",
};

/** Téléchargement Excel (élèves, absences, encaissements, soldes, heures des enseignants) pour la direction ou le comptable. */
export async function GET(request: Request, { params }: RouteContext<"/[lang]/exporter/[type]">) {
  const { lang: raw, type } = await params;
  const lang = isLocale(raw) ? raw : "fr";
  const permission = TYPES[type];
  if (!permission) return new Response("Not found", { status: 404 });
  const ctx = await requirePermission(lang, permission);
  const schoolId = ctx.school.id;
  const dict = await getDictionary(lang);
  const x = dict.exports;
  const year = await getCurrentYear(schoolId);
  const yearId = year?.id ?? "__aucune__";
  const name = (p: { firstName: string; lastName: string; firstNameAr?: string | null; lastNameAr?: string | null }) => [p.lastName, p.firstName].join(" ");
  const nameAr = (p: { firstNameAr?: string | null; lastNameAr?: string | null }) => [p.lastNameAr, p.firstNameAr].filter(Boolean).join(" ");
  const cls = (c: { name: string } | null | undefined) => c?.name ?? "";

  let columns: ExportColumn[] = [];
  let rows: ExportCell[][] = [];
  let period = todayISO();

  if (type === "eleves") {
    const students = await db.student.findMany({
      where: { schoolId, isActive: true },
      include: {
        enrollments: { where: { academicYearId: yearId }, include: { classGroup: true } },
        guardians: { include: { guardian: true }, orderBy: { isPrimary: "desc" } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    columns = [
      { header: x.number }, { header: x.lastFirst, width: 28 }, { header: x.nameAr, width: 24 }, { header: x.class },
      { header: x.birthDate, date: true }, { header: x.gender }, { header: x.parent, width: 26 }, { header: x.phone, width: 16 },
      { header: x.email, width: 26 }, { header: x.parent2, width: 26 }, { header: x.phone2, width: 16 },
    ];
    rows = students.map((s) => {
      const [g1, g2] = s.guardians.map((l) => l.guardian);
      return [
        s.studentNumber, name(s), nameAr(s), cls(s.enrollments[0]?.classGroup), s.birthDate, s.gender ? dict.exports.genders[s.gender] : "",
        g1 ? name(g1) : "", g1?.phone ?? "", g1?.email ?? "", g2 ? name(g2) : "", g2?.phone ?? "",
      ];
    });
  } else if (type === "absences") {
    const records = await db.attendanceRecord.findMany({
      where: { schoolId, classGroup: { academicYearId: yearId } },
      include: { student: true, classGroup: true },
      orderBy: [{ date: "desc" }, { classGroup: { name: "asc" } }],
    });
    columns = [
      { header: x.date, date: true }, { header: x.period }, { header: x.class }, { header: x.number }, { header: x.lastFirst, width: 28 },
      { header: x.status }, { header: x.justified }, { header: x.reason, width: 30 },
    ];
    rows = records.map((r) => [
      r.date, dict.attendance.periods[r.period], cls(r.classGroup), r.student.studentNumber, name(r.student),
      dict.attendance.statuses[r.status], r.justified ? x.yes : x.no, r.reason ?? "",
    ]);
  } else if (type === "encaissements") {
    const payments = await db.payment.findMany({
      where: { schoolId, academicYearId: yearId },
      include: { student: true },
      orderBy: { receiptNumber: "asc" },
    });
    columns = [
      { header: x.receipt }, { header: x.date, date: true }, { header: x.number }, { header: x.lastFirst, width: 28 },
      { header: x.amount, money: true }, { header: x.method }, { header: x.reference, width: 18 }, { header: x.cancelled, width: 30 },
    ];
    rows = payments.map((p) => [
      p.receiptNumber, p.paidAt, p.student.studentNumber, name(p.student), p.amountMillimes, dict.payments.methods[p.method],
      p.reference ?? "", p.cancelledAt ? `${x.yes} : ${p.cancelReason ?? ""}` : "",
    ]);
  } else if (type === "soldes") {
    const accounts = year ? await getSchoolAccounts(schoolId, year.id, todayISO()) : [];
    accounts.sort((a, b) => cls(a.classGroup).localeCompare(cls(b.classGroup)) || name(a.student).localeCompare(name(b.student)));
    columns = [
      { header: x.class }, { header: x.number }, { header: x.lastFirst, width: 28 }, { header: x.due, money: true },
      { header: x.paid, money: true }, { header: x.balance, money: true }, { header: x.overdue, money: true },
    ];
    rows = accounts.map((a) => [
      cls(a.classGroup), a.student.studentNumber, name(a.student), a.account.totalDue, a.account.totalPaid, a.account.balance, a.account.overdue,
    ]);
  }

  else if (type === "heures") {
    // Heures de cours du mois choisi, pour la paie (d'après l'emploi du temps).
    const chosen = parseMonth(new URL(request.url).searchParams.get("mois")) ?? parseMonth(todayISO().slice(0, 7))!;
    period = `${chosen.year}-${String(chosen.month).padStart(2, "0")}`;
    const counts = weekdayCounts(chosen.year, chosen.month);
    const teachers = await db.teacher.findMany({
      where: { schoolId, isActive: true },
      include: { entries: { where: { classGroup: { academicYearId: yearId } }, include: { classGroup: true, subject: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    columns = [
      { header: x.teacher, width: 28 }, { header: x.nameAr, width: 24 }, { header: x.phone, width: 16 }, { header: x.classes, width: 24 },
      { header: x.subjects, width: 24 }, { header: x.weekHours }, { header: x.sessions }, { header: x.monthHours },
    ];
    rows = teachers.map((t) => {
      const m = teachingMinutes(t.entries, counts);
      const sessions = t.entries.reduce((n, e) => n + (counts[e.dayOfWeek] ?? 0), 0);
      return [
        name(t), nameAr(t), t.phone ?? "", [...new Set(t.entries.map((e) => e.classGroup.name))].sort().join(", "),
        [...new Set(t.entries.map((e) => e.subject.nameFr))].join(", "), Math.round((m.week / 60) * 100) / 100, sessions, Math.round((m.month / 60) * 100) / 100,
      ];
    });
  }

  const buffer = await buildExport(x.sheets[type as keyof typeof x.sheets], columns, rows, lang === "ar");
  const fileName = `${type}-${ctx.school.slug}-${period}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
