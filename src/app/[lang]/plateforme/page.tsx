import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { pickName } from "@/i18n/localized";
import { parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/payments";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { createSchool, prepareDemoSchool } from "./actions";

export default async function PlatformPage({ params }: PageProps<"/[lang]/plateforme">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const p = dict.platform;
  const today = parseISODate(todayISO())!;
  const schools = await db.school.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { students: { where: { isActive: true } } } } },
  });
  const lastLogins = await db.membership.groupBy({ by: ["schoolId"], where: { isActive: true }, _count: true });
  const members = new Map(lastLogins.map((m) => [m.schoolId, m._count]));
  const monthly = schools.filter((s) => s.isActive).reduce((sum, s) => sum + (s.planPriceMillimes ?? 0), 0);
  const fmt = (d: Date) => new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
  const year = Number(todayISO().slice(0, 4));
  const defaultYear = Number(todayISO().slice(5, 7)) >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={p.schools} subtitle={t(p.summary, { count: schools.filter((s) => s.isActive).length, amount: formatMoney(monthly, lang) })} />
      <Card>
        {schools.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noSchools}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {schools.map((s) => {
              const late = s.paidUntil != null && s.paidUntil < today;
              return (
                <li key={s.id}>
                  <Link href={`/${lang}/plateforme/${s.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-gold-50">
                    <span className="min-w-0">
                      <span className="block font-semibold">{pickName(s, lang)}</span>
                      <span className="block text-xs text-slate-500">
                        {[s.city, t(p.students, { count: s._count.students }), t(p.accounts, { count: members.get(s.id) ?? 0 })].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      {s.plan && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-900">{s.plan}</span>}
                      {s.paidUntil && (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${late ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
                          {t(late ? p.lateSince : p.paidUntilShort, { date: fmt(s.paidUntil) })}
                        </span>
                      )}
                      {!s.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">{p.suspended}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={p.demoTitle}>
        <p className="mb-3 text-sm text-slate-600">{p.demoIntro}</p>
        <ActionForm
          action={prepareDemoSchool.bind(null, lang)}
          labels={{ ...formLabels(dict, p.demoButton), credentials: { intro: p.demoDone, login: dict.account.identity, password: dict.guardians.tempPassword } }}
        />
      </Card>

      <Card title={p.newSchool}>
        <ActionForm
          action={createSchool.bind(null, lang)}
          labels={{ ...formLabels(dict, p.create), credentials: { intro: p.created, login: dict.account.identity, password: dict.guardians.tempPassword } }}
          resetOnSuccess
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.nameFr}><Input name="nameFr" required maxLength={120} /></Field>
            <Field label={p.nameAr}><Input name="nameAr" required maxLength={120} dir="rtl" /></Field>
            <Field label={p.city}><Input name="city" maxLength={80} /></Field>
            <Field label={p.year}><Input name="yearLabel" required defaultValue={defaultYear} pattern="\d{4}-\d{4}" /></Field>
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 font-medium">{p.cycles}</legend>
            {(["PRIMARY", "MIDDLE", "SECONDARY"] as const).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="checkbox" name="cycles" value={c} defaultChecked={c !== "SECONDARY"} className="h-5 w-5" /> {dict.cycles[c]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={p.adminEmail}><Input name="adminEmail" type="email" required /></Field>
            <Field label={p.adminFirstName}><Input name="adminFirstName" required maxLength={120} /></Field>
            <Field label={p.adminLastName}><Input name="adminLastName" required maxLength={120} /></Field>
          </div>
          <p className="text-xs text-slate-500">{p.createHint}</p>
        </ActionForm>
      </Card>
    </div>
  );
}
