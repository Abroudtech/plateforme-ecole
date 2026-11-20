import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { computeClassReport, getTerms, pickTerm } from "@/lib/data/grades";
import { computeClassAnnual } from "@/lib/data/annual";
import { formulaText } from "@/lib/grades/annual";
import { round2 } from "@/lib/grades/compute";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { ClassTabs, TermTabs } from "../../class-tabs";
import { setPublication } from "../../grades-actions";

export default async function ClassReportsPage({ params, searchParams }: PageProps<"/[lang]/classes/[id]/bulletins">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "grades.read");
  const cls = await db.classGroup.findFirst({ where: { schoolId: ctx.school.id, id }, include: { gradeLevel: true } });
  if (!cls) notFound();

  const terms = await getTerms(ctx.school.id, cls.academicYearId, cls.gradeLevel.cycle);
  const isAnnual = sp.trimestre === "annuel";
  const term = isAnnual ? null : pickTerm(terms, typeof sp.trimestre === "string" ? sp.trimestre : undefined);
  const report = term ? await computeClassReport(ctx.school.id, cls.id, term.id) : null;
  const r = dict.reportCards;
  const tabTerms = [...terms, { id: "annuel", nameFr: dict.reportCards.annualTab, nameAr: dict.reportCards.annualTab }];
  if (isAnnual) {
    const annual = await computeClassAnnual(ctx.school.id, cls.id);
    const order = annual ? [...annual.students].sort((a, b) => (annual.ranks.get(a.id) ?? 1e9) - (annual.ranks.get(b.id) ?? 1e9)) : [];
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={r.title} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
        <ClassTabs lang={lang} classId={cls.id} dict={dict} active="reports" />
        <TermTabs terms={tabTerms} activeId="annuel" lang={lang} hrefFor={(tid) => `/${lang}/classes/${cls.id}/bulletins?trimestre=${tid}`} />
        {!annual ? (
          <Card><p className="text-slate-600">{dict.grades.noTerms}</p></Card>
        ) : (
          <Card>
            <p className="mb-1 text-sm text-slate-600" dir="ltr">{t(r.formula, { formula: formulaText(annual.rule.termWeights), pass: annual.rule.passMark })}</p>
            <p className="mb-3 text-xs text-slate-500">{r.annualPublishHint}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 text-start font-medium">{r.rank}</th>
                    <th className="py-2 text-start font-medium">{r.student}</th>
                    {annual.terms.map((tm, i) => (
                      <th key={tm.id} className="px-1 py-2 text-center font-medium">T{i + 1}</th>
                    ))}
                    <th className="py-2 text-end font-medium">{r.annual}</th>
                    <th className="py-2 ps-2 text-end font-medium">{r.decision}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.map((s) => {
                    const a = annual.annual.get(s.id)!;
                    const d = annual.decisions.get(s.id)!;
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-2.5 text-slate-500">{annual.ranks.get(s.id) ?? "—"}</td>
                        <td className="py-2.5">
                          <Link href={`/${lang}/eleves/${s.id}/bulletin?trimestre=annuel`} className="font-medium text-blue-700 hover:underline">
                            {personName(s, lang)}
                          </Link>
                        </td>
                        {annual.termGenerals.get(s.id)!.map((v, i) => (
                          <td key={i} className="px-1 py-2.5 text-center text-slate-600" dir="ltr">{v == null ? "—" : round2(v).toFixed(2)}</td>
                        ))}
                        <td className="py-2.5 text-end font-semibold" dir="ltr">
                          {a.average == null ? "—" : round2(a.average).toFixed(2)}{!a.complete && a.average != null ? "*" : ""}
                        </td>
                        <td className={`py-2.5 ps-2 text-end text-xs font-medium ${d === "PASS" ? "text-green-700" : d === "FAIL" ? "text-red-700" : "text-slate-500"}`}>
                          {dict.decisions[d]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {order.some((s) => !annual.annual.get(s.id)!.complete) && <p className="mt-2 text-xs text-slate-500">* {r.provisional}</p>}
          </Card>
        )}
      </div>
    );
  }
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { dateStyle: "long" });

  // Élèves triés par rang (ceux sans moyenne à la fin).
  const rows = report
    ? [...report.students].sort((a, b) => (report.ranks.get(a.id) ?? 1e9) - (report.ranks.get(b.id) ?? 1e9))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={r.title} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="reports" />

      {!term || !report ? (
        <Card><p className="text-slate-600">{dict.grades.noTerms}</p></Card>
      ) : (
        <>
          <TermTabs terms={tabTerms} activeId={term.id} lang={lang} hrefFor={(tid) => `/${lang}/classes/${cls.id}/bulletins?trimestre=${tid}`} />

          <Card>
            <p className={`mb-3 text-sm ${report.publication ? "text-green-700" : "text-amber-700"}`}>
              {report.publication ? t(r.published, { date: dateFmt.format(report.publication.publishedAt) }) : r.notPublished}
            </p>
            {can(ctx.roles, "reportCards.publish") && (
              <ActionForm
                action={setPublication.bind(null, lang, cls.id, term.id, !report.publication)}
                labels={formLabels(dict, report.publication ? r.unpublish : r.publish)}
                variant={report.publication ? "secondary" : "primary"}
                confirm={report.publication ? undefined : `${r.publish} ?`}
              />
            )}
          </Card>

          <Card>
            {report.assessmentCount === 0 && <p className="mb-2 text-sm text-slate-500">{r.noGrades}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">{r.rank}</th>
                  <th className="py-2 text-start font-medium">{r.student}</th>
                  <th className="py-2 text-end font-medium">{r.general}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const avg = report.generals.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2.5 text-slate-500">{report.ranks.get(s.id) ?? "—"}</td>
                      <td className="py-2.5">
                        <Link href={`/${lang}/eleves/${s.id}/bulletin?trimestre=${term.id}`} className="font-medium text-blue-700 hover:underline">
                          {personName(s, lang)}
                        </Link>
                      </td>
                      <td className="py-2.5 text-end font-semibold" dir="ltr">{avg == null ? "—" : round2(avg).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {report.classStats && (
              <p className="mt-3 text-xs text-slate-500" dir="auto">
                {r.classAverage} : {round2(report.classStats.mean).toFixed(2)} · {r.highest} : {round2(report.classStats.max).toFixed(2)} · {r.lowest} : {round2(report.classStats.min).toFixed(2)}
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
