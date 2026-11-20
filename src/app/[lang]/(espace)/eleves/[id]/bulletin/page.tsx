import { notFound, redirect } from "next/navigation";
import { hasStudentAccess } from "@/lib/auth/scope";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { computeClassReport, getStudentClass, getTerms, isGuardianOf, pickTerm } from "@/lib/data/grades";
import { getCurrentYear } from "@/lib/data/school";
import { computeClassAnnual } from "@/lib/data/annual";
import { AnnualBulletin } from "@/components/report/annual-bulletin";
import { ActionForm } from "@/components/action-form";
import { Bulletin } from "@/components/report/bulletin";
import { PrintButton } from "@/components/print-button";
import { Card, PageHeader } from "@/components/ui";
import { TermTabs } from "../../../classes/class-tabs";
import { saveTermComment } from "../../../classes/grades-actions";

/**
 * Bulletin d'un élève. Visible par l'administration, et par ses parents
 * uniquement une fois le bulletin publié.
 */
export default async function StudentBulletinPage({ params, searchParams }: PageProps<"/[lang]/eleves/[id]/bulletin">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const [dict, fr, ar] = await Promise.all([getDictionary(lang), getDictionary("fr"), getDictionary("ar")]);
  const ctx = await requireContext(lang);
  const schoolId = ctx.school.id;

  const isStaff = can(ctx.roles, "grades.read") && (await hasStudentAccess(ctx, id));
  if (!isStaff && !(can(ctx.roles, "children.read") && (await isGuardianOf(schoolId, ctx.user.id, id)))) {
    redirect(`/${lang}/acces-refuse`);
  }

  const year = await getCurrentYear(schoolId);
  const enrollment = year ? await getStudentClass(schoolId, id, year.id) : null;
  if (!enrollment) notFound();
  const terms = await getTerms(schoolId, year!.id, enrollment.classGroup.gradeLevel.cycle);
  const tabTerms = [...terms, { id: "annuel", nameFr: dict.reportCards.annualTab, nameAr: dict.reportCards.annualTab }];
  if (sp.trimestre === "annuel") {
    const annual = await computeClassAnnual(schoolId, enrollment.classGroupId);
    const st = annual?.students.find((s) => s.id === id);
    const canSee = !!annual && !!st && (isStaff || annual.published);
    return (
      <div className="flex flex-col gap-4">
        <div className="print:hidden">
          <PageHeader
            title={dict.reportCards.annualTitle}
            subtitle={st ? personName(st, lang) : undefined}
            back={isStaff ? { href: `/${lang}/eleves/${id}`, label: dict.nav.back } : { href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
            action={canSee ? <PrintButton label={dict.reportCards.print} /> : undefined}
          />
          <TermTabs terms={tabTerms} activeId="annuel" lang={lang} hrefFor={(tid) => `/${lang}/eleves/${id}/bulletin?trimestre=${tid}`} />
          {isStaff && annual && !annual.published && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{dict.reportCards.annualPublishHint}</p>
          )}
        </div>
        {canSee ? (
          <AnnualBulletin data={annual!} studentId={id} school={ctx.school} fr={fr} ar={ar} />
        ) : (
          <Card><p className="text-slate-600">{dict.reportCards.annualNotAvailable}</p></Card>
        )}
      </div>
    );
  }
  const term = pickTerm(terms, typeof sp.trimestre === "string" ? sp.trimestre : undefined);
  const report = term ? await computeClassReport(schoolId, enrollment.classGroupId, term.id) : null;
  const student = report?.students.find((s) => s.id === id);
  const visible = !!report && !!student && (isStaff || !!report.publication);

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <PageHeader
          title={dict.reportCards.bulletin}
          subtitle={student ? personName(student, lang) : undefined}
          back={isStaff ? { href: `/${lang}/eleves/${id}`, label: dict.nav.back } : { href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
          action={visible ? <PrintButton label={dict.reportCards.print} /> : undefined}
        />
        {term && (
          <TermTabs terms={tabTerms} activeId={term.id} lang={lang} hrefFor={(tid) => `/${lang}/eleves/${id}/bulletin?trimestre=${tid}`} />
        )}
        {isStaff && report && !report.publication && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{dict.reportCards.notPublished}</p>
        )}
      </div>

      {visible && term ? (
        <Bulletin report={report!} studentId={id} term={term} school={ctx.school} fr={fr} ar={ar} />
      ) : (
        <Card><p className="text-slate-600">{dict.reportCards.notAvailable}</p></Card>
      )}

      {isStaff && can(ctx.roles, "grades.write") && term && student && (
        <Card title={dict.reportCards.comment} className="print:hidden">
          <ActionForm action={saveTermComment.bind(null, lang, id, term.id)} labels={formLabels(dict)}>
            <textarea
              name="comment"
              rows={3}
              maxLength={1000}
              dir="auto"
              defaultValue={report?.comments.get(id) ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
