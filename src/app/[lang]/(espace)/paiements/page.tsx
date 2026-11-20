import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ltr, t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { todayISO } from "@/lib/dates";
import { listClasses } from "@/lib/data/classes";
import { getSchoolAccounts } from "@/lib/data/payments";
import { getCurrentYear } from "@/lib/data/school";
import { Money } from "@/components/money";
import { Card, PageHeader } from "@/components/ui";

type Filter = "overdue" | "balance" | "all";

/** Tableau de bord des paiements : chiffres clés et suivi des impayés. */
export default async function PaymentsPage({ params, searchParams }: PageProps<"/[lang]/paiements">) {
  const lang = (await params).lang as Locale;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "payments.read");
  const p = dict.payments;
  const year = await getCurrentYear(ctx.school.id);
  const today = todayISO();
  const [rows, classes] = year
    ? await Promise.all([getSchoolAccounts(ctx.school.id, year.id, today), listClasses(ctx.school.id, year.id)])
    : [[], []];

  const filter: Filter = sp.voir === "tous" ? "all" : sp.voir === "reste" ? "balance" : "overdue";
  const classId = typeof sp.classe === "string" ? sp.classe : "";
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totals = {
    due: sum((r) => r.account.totalDue),
    paid: sum((r) => Math.min(r.account.totalPaid, r.account.totalDue)),
    balance: sum((r) => r.account.balance),
    overdue: sum((r) => r.account.overdue),
    overdueCount: rows.filter((r) => r.account.overdue > 0).length,
  };
  const list = rows
    .filter((r) => !classId || r.classGroup.id === classId)
    .filter((r) => (filter === "overdue" ? r.account.overdue > 0 : filter === "balance" ? r.account.balance > 0 : true))
    .sort((a, b) => b.account.overdue - a.account.overdue || b.account.balance - a.account.balance || a.student.lastName.localeCompare(b.student.lastName));

  const href = (voir: string, classe = classId) => {
    const q = new URLSearchParams();
    if (voir) q.set("voir", voir);
    if (classe) q.set("classe", classe);
    const s = q.toString();
    return `/${lang}/paiements${s ? `?${s}` : ""}`;
  };
  const voirParam = filter === "all" ? "tous" : filter === "balance" ? "reste" : "";
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={p.title}
        subtitle={year ? ltr(year.label) : dict.formErrors.noYear}
        back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: p.totalDue, value: totals.due, cls: "" },
          { label: p.collected, value: totals.paid, cls: "text-green-700" },
          { label: p.remaining, value: totals.balance, cls: "" },
          { label: p.overdue, value: totals.overdue, cls: totals.overdue > 0 ? "text-red-700" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls}`}><Money value={s.value} lang={lang} /></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/${lang}/paiements/frais`} className="rounded-xl bg-white p-4 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50">
          {p.manageFees}
        </Link>
        <Link href={`/${lang}/paiements/encaissements`} className="rounded-xl bg-white p-4 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50">
          {p.journal}
        </Link>
      </div>

      <Card title={p.unpaid}>
        {totals.overdueCount > 0 && <p className="mb-3 text-sm font-medium text-red-700">{t(p.studentsOverdue, { count: totals.overdueCount })}</p>}
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {([["", p.onlyOverdue, "overdue"], ["reste", p.withBalance, "balance"], ["tous", p.allStudents, "all"]] as const).map(([v, label, key]) => (
            <Link
              key={key}
              href={href(v)}
              className={`rounded-full px-3 py-1.5 ${filter === key ? "bg-blue-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 text-sm">
          <Link href={href(voirParam, "")} className={`shrink-0 rounded-full px-3 py-1 ${!classId ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
            {p.allStudents}
          </Link>
          {classes.map((c) => (
            <Link key={c.id} href={href(voirParam, c.id)} className={`shrink-0 rounded-full px-3 py-1 ${classId === c.id ? "bg-slate-800 text-white" : "bg-slate-100"}`}>
              {lang === "ar" && c.nameAr ? c.nameAr : c.name}
            </Link>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noUnpaid}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((r) => (
              <li key={r.studentId}>
                <Link
                  href={`/${lang}/eleves/${r.studentId}/paiements`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 hover:bg-blue-50"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{personName(r.student, lang)}</span>
                    <span className="block text-sm text-slate-500">
                      {lang === "ar" && r.classGroup.nameAr ? r.classGroup.nameAr : r.classGroup.name}
                      {" · "}
                      {r.lastReminder ? t(p.lastReminder, { date: fmt.format(r.lastReminder) }) : p.neverReminded}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-sm">
                    {r.account.overdue > 0 && <Money value={r.account.overdue} lang={lang} className="block font-semibold text-red-700" />}
                    <span className="text-slate-600">{p.balance} : <Money value={r.account.balance} lang={lang} /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
