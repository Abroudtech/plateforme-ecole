import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { className, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { getNextYear, getRolloverSummary } from "@/lib/data/rollover";
import { getCurrentYear } from "@/lib/data/school";
import { nextYearLabel } from "@/lib/rollover";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { deletePreparedYear, prepareYear, switchYear, undoSwitch } from "./actions";

/** Passage à l'année suivante, en trois étapes : préparer, répartir les élèves, basculer. */
export default async function NextYearPage({ params }: PageProps<"/[lang]/annee-suivante">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "settings.write");
  const y = dict.rollover;
  const current = await getCurrentYear(ctx.school.id);
  const next = await getNextYear(ctx.school.id);
  const previous = current
    ? await db.academicYear.findFirst({ where: { schoolId: ctx.school.id, isCurrent: false, startDate: { lt: current.startDate } }, orderBy: { startDate: "desc" } })
    : null;
  const summary = current && next ? await getRolloverSummary(ctx.school.id, current.id, next.id) : null;
  const unplaced = summary ? summary.total - summary.placed - summary.leaving : 0;
  const check = (name: string, label: string, checked = true) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-5" /> {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={y.title} subtitle={current ? t(y.current, { year: current.label }) : dict.formErrors.noYear} back={{ href: `/${lang}/parametres`, label: dict.nav.settings }} />

      {!next && current && (
        <Card title={`1. ${y.step1}`}>
          <p className="mb-4 text-sm text-slate-600">{y.step1Intro}</p>
          <ActionForm action={prepareYear.bind(null, lang)} labels={formLabels(dict, y.prepare)}>
            <Field label={y.label}>
              <Input name="label" required dir="ltr" defaultValue={nextYearLabel(current.label)} className="max-w-40" />
            </Field>
            <div className="flex flex-col gap-2">
              {check("teachers", y.copyTeachers)}
              {check("timetable", y.copyTimetable)}
              {check("discounts", y.copyDiscounts)}
            </div>
          </ActionForm>
          {previous && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm text-slate-600">{t(y.undoIntro, { year: previous.label })}</p>
              <ActionForm action={undoSwitch.bind(null, lang)} labels={formLabels(dict, t(y.undo, { year: previous.label }))} variant="secondary" confirm={t(y.undo, { year: previous.label })} />
            </div>
          )}
        </Card>
      )}

      {next && summary && current && (
        <>
          <Card title={`2. ${t(y.step2, { year: next.label })}`}>
            <p className="mb-3 text-sm text-slate-600">{y.step2Intro}</p>
            <ul className="divide-y divide-slate-100">
              {summary.classes.map((c) => (
                <li key={c.id}>
                  <Link href={`/${lang}/annee-suivante/${c.id}`} className="flex items-center gap-3 py-3 hover:text-blue-700">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{className(c, lang)}</span>
                      <span className="text-sm text-slate-500"> · {pickName(c.gradeLevel, lang)}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.placed >= c._count.enrollments ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {t(y.placedOf, { placed: c.placed, total: c._count.enrollments })}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <ActionForm action={deletePreparedYear.bind(null, lang)} labels={formLabels(dict, t(y.deleteYear, { year: next.label }))} variant="danger" confirm={t(y.deleteYear, { year: next.label })} />
            </div>
          </Card>

          <Card title={`3. ${t(y.step3, { year: next.label })}`}>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              <li>{t(y.sumPlaced, { placed: summary.placed, total: summary.total })}</li>
              <li>{t(y.sumLeaving, { count: summary.leaving })}</li>
              {unplaced > 0 && <li className="font-semibold text-amber-800">{t(y.sumUnplaced, { count: unplaced })}</li>}
            </ul>
            <p className="mb-3 text-sm text-slate-600">{y.step3Intro}</p>
            <ActionForm action={switchYear.bind(null, lang)} labels={formLabels(dict, t(y.switch, { year: next.label }))} confirm={t(y.switchConfirm, { year: next.label })} />
          </Card>
        </>
      )}
    </div>
  );
}
