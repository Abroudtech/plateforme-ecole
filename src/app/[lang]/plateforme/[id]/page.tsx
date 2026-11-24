import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName, pickName } from "@/i18n/localized";
import { toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { saveSiteDomain, saveSubscription } from "../actions";
import { t } from "@/i18n/format";

export default async function PlatformSchoolPage({ params }: PageProps<"/[lang]/plateforme/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const p = dict.platform;
  const school = await db.school.findUnique({ where: { id } });
  if (!school) notFound();
  const [students, teachers, classes, parents, admins, lastLogin] = await Promise.all([
    db.student.count({ where: { schoolId: id, isActive: true } }),
    db.teacher.count({ where: { schoolId: id, isActive: true } }),
    db.classGroup.count({ where: { schoolId: id, academicYear: { isCurrent: true } } }),
    db.guardian.count({ where: { schoolId: id, userId: { not: null } } }),
    db.membership.findMany({ where: { schoolId: id, role: "ADMIN", isActive: true }, include: { user: true } }),
    db.user.aggregate({ where: { memberships: { some: { schoolId: id } } }, _max: { lastLoginAt: true } }),
  ]);
  const site = await db.schoolSite.findUnique({ where: { schoolId: id }, select: { domain: true } });
  const fmt = (d: Date | null) =>
    d ? new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }).format(d) : "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pickName(school, lang)} subtitle={school.city ?? undefined} back={{ href: `/${lang}/plateforme`, label: p.schools }} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [p.statStudents, students],
          [p.statTeachers, teachers],
          [p.statClasses, classes],
          [p.statParents, parents],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-blue-900">{value}</p>
          </div>
        ))}
      </section>
      <p className="text-sm text-slate-600">{p.lastActivity} : {fmt(lastLogin._max.lastLoginAt)}</p>

      <Card title={p.subscription}>
        <ActionForm action={saveSubscription.bind(null, lang, school.id)} labels={formLabels(dict, dict.common.save)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={p.plan}><Input name="plan" maxLength={60} defaultValue={school.plan ?? ""} placeholder={p.planPlaceholder} /></Field>
            <Field label={p.price}><Input name="price" inputMode="decimal" defaultValue={school.planPriceMillimes != null ? String(school.planPriceMillimes / 1000) : ""} /></Field>
            <Field label={p.paidUntil}><Input name="paidUntil" type="date" defaultValue={school.paidUntil ? toISODate(school.paidUntil) : ""} /></Field>
          </div>
          <Field label={p.note}><Textarea name="note" rows={3} maxLength={2000} defaultValue={school.platformNote ?? ""} /></Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={school.isActive} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-medium">{p.active}</span>
              <span className="text-slate-500">{p.activeHint}</span>
            </span>
          </label>
        </ActionForm>
      </Card>

      <Card title={p.siteDomain}>
        <ActionForm action={saveSiteDomain.bind(null, lang, school.id)} labels={formLabels(dict, dict.common.save)}>
          <Field label={p.siteDomain} hint={dict.common.optional}>
            <Input name="domain" dir="ltr" maxLength={253} defaultValue={site?.domain ?? ""} placeholder="monecole.tn" />
          </Field>
          <p className="text-sm text-slate-500">{p.siteDomainHint} {t(p.siteDomainNone, { slug: school.slug })}</p>
        </ActionForm>
      </Card>

      <Card title={p.admins}>
        <ul className="flex flex-col gap-1.5 text-sm">
          {admins.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-semibold">{personName(m.user, lang)}</span>
              <span className="text-slate-600"><bdi dir="ltr">{m.user.email ?? m.user.phone}</bdi> · {fmt(m.user.lastLoginAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
