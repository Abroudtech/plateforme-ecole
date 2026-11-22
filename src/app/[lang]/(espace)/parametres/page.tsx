import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { requirePermission } from "@/lib/auth/context";
import { getAnnualRule } from "@/lib/data/annual";
import { formulaText } from "@/lib/grades/annual";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { addAdmin, removeAdmin, resetAnnualRule, saveAnnualRule, saveGradesVisibility, saveSchoolInfo, saveTeacherMessaging } from "./actions";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { personName } from "@/i18n/localized";

export default async function SettingsPage({ params }: PageProps<"/[lang]/parametres">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "settings.write");
  const st = dict.settings;
  const school = ctx.school;
  const cycles = (["PRIMARY", "MIDDLE", "SECONDARY"] as const).filter((c) => school.cycles.includes(c));
  const team = await db.membership.findMany({
    where: { schoolId: school.id, role: "ADMIN", isActive: true },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const rules = await Promise.all(cycles.map(async (c) => ({ cycle: c, rule: await getAnnualRule(school.id, c) })));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={st.title} back={{ href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }} />

      <Card title={st.school}>
        <ActionForm action={saveSchoolInfo.bind(null, lang)} labels={formLabels(dict, dict.common.save)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={st.nameFr}><Input name="nameFr" required defaultValue={school.nameFr} /></Field>
            <Field label={st.nameAr}><Input name="nameAr" required lang="ar" dir="rtl" defaultValue={school.nameAr} /></Field>
            <Field label={st.address} hint={dict.common.optional}><Input name="address" defaultValue={school.address ?? ""} /></Field>
            <Field label={st.city} hint={dict.common.optional}><Input name="city" defaultValue={school.city ?? ""} /></Field>
            <Field label={st.phone} hint={dict.common.optional}><Input name="phone" type="tel" dir="ltr" defaultValue={school.phone ?? ""} /></Field>
            <Field label={st.email} hint={dict.common.optional}><Input name="email" type="email" dir="ltr" defaultValue={school.email ?? ""} /></Field>
          </div>
        </ActionForm>
      </Card>

      <Card title={dict.progress.settingTitle}>
        <ActionForm action={saveGradesVisibility.bind(null, lang)} labels={formLabels(dict, dict.common.save)}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="showGradesToParents" defaultChecked={school.showGradesToParents} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-medium">{dict.progress.settingLabel}</span>
              <span className="text-slate-500">{dict.progress.settingHint}</span>
            </span>
          </label>
        </ActionForm>
      </Card>

      <Card title={dict.messages.settingTitle}>
        <ActionForm action={saveTeacherMessaging.bind(null, lang)} labels={formLabels(dict, dict.common.save)}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="teacherMessaging" defaultChecked={school.teacherMessaging} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-medium">{dict.messages.settingLabel}</span>
              <span className="text-slate-500">{dict.messages.settingHint}</span>
            </span>
          </label>
        </ActionForm>
      </Card>

      <Card title={st.annualRules}>
        <p className="mb-4 text-sm text-slate-600">{st.annualIntro}</p>
        <div className="flex flex-col gap-5">
          {rules.map(({ cycle, rule }) => (
            <section key={cycle} className="rounded-xl bg-slate-50 p-3">
              <h3 className="font-semibold">
                {dict.cycles[cycle]}{" "}
                <span className="text-sm font-normal text-slate-500">· {rule.custom ? st.customized : st.byDefault}</span>
              </h3>
              <p className="mb-2 text-sm text-slate-600" dir="ltr">{t(dict.reportCards.formula, { formula: formulaText(rule.termWeights), pass: rule.passMark })}</p>
              <ActionForm action={saveAnnualRule.bind(null, lang, cycle)} labels={formLabels(dict, dict.common.save)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={st.termWeights} hint={st.weightsHint}>
                    <Input name="weights" required dir="ltr" defaultValue={rule.termWeights.join(", ")} />
                  </Field>
                  <Field label={st.passMark}>
                    <Input name="passMark" required dir="ltr" inputMode="decimal" defaultValue={String(rule.passMark)} />
                  </Field>
                </div>
              </ActionForm>
              {rule.custom && (
                <ActionForm action={resetAnnualRule.bind(null, lang, cycle)} labels={formLabels(dict, st.reset)} variant="secondary" className="mt-2" />
              )}
            </section>
          ))}
        </div>
      </Card>

      <Card title={dict.rollover.title}>
        <p className="mb-3 text-sm text-slate-600">{dict.rollover.linkIntro}</p>
        <Link href={`/${lang}/annee-suivante`} className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
          {dict.rollover.link}
        </Link>
      </Card>

      <Card title={dict.importer.title}>
        <p className="mb-3 text-sm text-slate-600">{dict.importer.subtitle}.</p>
        <Link href={`/${lang}/importer`} className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
          {dict.importer.shortcut}
        </Link>
      </Card>

      <Card title={dict.exports.title}>
        <p className="mb-3 text-sm text-slate-600">{dict.exports.intro}</p>
        <div className="flex flex-wrap gap-2">
          {(["eleves", "absences", "encaissements", "soldes"] as const).map((type) => (
            <a
              key={type}
              href={`/${lang}/exporter/${type}`}
              download
              className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              {dict.exports.sheets[type]}
            </a>
          ))}
        </div>
        <form action={`/${lang}/exporter/heures`} method="get" className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {dict.exports.sheets.heures}
            <Input type="month" name="mois" defaultValue={todayISO().slice(0, 7)} required className="w-44" />
          </label>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">{dict.exports.download}</button>
          <p className="w-full text-xs text-slate-500">{dict.exports.hoursHint}</p>
        </form>
      </Card>

      <Card title={st.team}>
        <ul className="mb-4 flex flex-col gap-2">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span>
                <span className="font-semibold">{personName(m.user, lang)}</span>
                {m.userId === ctx.user.id && <span className="text-sm text-slate-500"> ({st.you})</span>}
                <bdi dir="ltr" className="block text-sm text-slate-500">{m.user.email ?? m.user.phone}</bdi>
              </span>
              {m.userId !== ctx.user.id && (
                <ActionForm
                  action={removeAdmin.bind(null, lang, m.userId)}
                  labels={formLabels(dict, st.removeAccess)}
                  variant="danger"
                  confirm={`${st.removeAccess} ?`}
                  className="[&_button]:px-2 [&_button]:py-1 [&_button]:text-xs"
                />
              )}
            </li>
          ))}
        </ul>
        <h3 className="mb-2 font-medium">{st.addAdmin}</h3>
        <ActionForm
          action={addAdmin.bind(null, lang)}
          labels={{ ...formLabels(dict, dict.common.add), credentials: { intro: st.adminCreated, login: dict.account.identity, password: dict.guardians.tempPassword } }}
          resetOnSuccess
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={st.firstName}><Input name="firstName" required /></Field>
            <Field label={st.lastName}><Input name="lastName" required /></Field>
            <Field label={st.email}><Input name="email" type="email" required dir="ltr" /></Field>
          </div>
        </ActionForm>
      </Card>

      <Link href={`/${lang}/messages/alertes`} className="rounded-xl bg-white p-4 font-medium text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50">
        {st.alerts}
      </Link>
    </div>
  );
}
