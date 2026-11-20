import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getClass } from "@/lib/data/classes";
import { getAssessments, getClassCurriculum, getTerms, pickTerm } from "@/lib/data/grades";
import { loadSchemeResolver } from "@/lib/grades/scheme";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { ClassTabs, TermTabs } from "../../class-tabs";
import { createAssessment, saveGradeGrid } from "../../grades-actions";

export default async function GradesPage({ params, searchParams }: PageProps<"/[lang]/classes/[id]/notes">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "grades.read");
  const cls = await getClass(ctx.school.id, id);
  if (!cls) notFound();

  const terms = await getTerms(ctx.school.id, cls.academicYearId, cls.gradeLevel.cycle);
  const term = pickTerm(terms, typeof sp.trimestre === "string" ? sp.trimestre : undefined);
  const curriculum = await getClassCurriculum(ctx.school.id, cls);
  const subject = curriculum.find((c) => c.subjectId === sp.matiere) ?? curriculum[0];
  const canWrite = can(ctx.roles, "grades.write");
  const g = dict.grades;
  const base = `/${lang}/classes/${cls.id}/notes`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={g.title} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="grades" />

      {!term ? (
        <Card><p className="text-slate-600">{g.noTerms}</p></Card>
      ) : !subject ? (
        <Card>
          <p className="text-slate-600">{g.noCurriculum}</p>
          <Link href={`/${lang}/classes/${cls.id}/matieres`} className="mt-2 inline-block font-medium text-blue-700 underline">{dict.curriculum.title}</Link>
        </Card>
      ) : (
        <>
          <TermTabs terms={terms} activeId={term.id} lang={lang} hrefFor={(tid) => `${base}?trimestre=${tid}&matiere=${subject.subjectId}`} />
          <Tabs
            active={subject.subjectId}
            items={curriculum.map((c) => ({ key: c.subjectId, href: `${base}?trimestre=${term.id}&matiere=${c.subjectId}`, label: pickName(c.subject, lang) }))}
          />
          <SubjectGrid lang={lang} dict={dict} schoolId={ctx.school.id} cls={cls} termId={term.id} subject={subject} canWrite={canWrite} />
        </>
      )}
    </div>
  );
}

/** Grille de saisie d'une matière : une ligne par élève, une colonne par type de note. */
async function SubjectGrid({
  lang,
  dict,
  schoolId,
  cls,
  termId,
  subject,
  canWrite,
}: {
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
  schoolId: string;
  cls: NonNullable<Awaited<ReturnType<typeof getClass>>>;
  termId: string;
  subject: Awaited<ReturnType<typeof getClassCurriculum>>[number];
  canWrite: boolean;
}) {
  const g = dict.grades;
  const scheme = (await loadSchemeResolver(db, schoolId, cls))(subject.subjectId);
  const all = (await getAssessments(schoolId, cls.id, termId)).filter((a) => a.subjectId === subject.subjectId);
  // La première évaluation de chaque type alimente la colonne ; les autres sont "supplémentaires".
  const columns = scheme.items.map((item) => ({ ...item, assessment: all.find((a) => a.kind === item.kind) }));
  const used = new Set(columns.map((c) => c.assessment?.id).filter(Boolean));
  const extras = all.filter((a) => !used.has(a.id));
  const grades = await db.grade.findMany({ where: { schoolId, assessmentId: { in: columns.flatMap((c) => (c.assessment ? [c.assessment.id] : [])) } } });
  const cell = (assessmentId: string | undefined, studentId: string) => {
    const gr = grades.find((x) => x.assessmentId === assessmentId && x.studentId === studentId);
    if (!gr) return "";
    return gr.absent ? "abs" : gr.score != null ? String(Number(gr.score)) : "";
  };

  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{pickName(subject.subject, lang)}</h2>
          <Link href={`/${lang}/classes/${cls.id}/structure?matiere=${subject.subjectId}`} className="text-xs text-blue-700 hover:underline">
            {dict.curriculum.coefficient} {Number(subject.coefficient)} · {scheme.items.map((i) => `${g.kindsShort[i.kind]} ×${i.weight}`).join(" · ")}
          </Link>
        </div>
        <p className="mb-3 text-sm text-slate-600">{g.gridHint}</p>
        <ActionForm action={saveGradeGrid.bind(null, lang, cls.id, termId, subject.subjectId)} labels={formLabels(dict)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">{dict.reportCards.student}</th>
                  {columns.map((c) => (
                    <th key={c.kind} className="px-1 py-2 text-center font-medium">
                      {g.kindsShort[c.kind]}
                      <span className="block font-normal">×{c.weight}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cls.enrollments.map(({ student }) => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="py-1.5 pe-2 font-medium">{personName(student, lang)}</td>
                    {columns.map((c) => (
                      <td key={c.kind} className="px-1 py-1.5 text-center">
                        <input
                          name={`g_${c.kind}_${student.id}`}
                          inputMode="decimal"
                          dir="ltr"
                          autoComplete="off"
                          aria-label={`${g.kindsShort[c.kind]} ${personName(student, lang)}`}
                          defaultValue={cell(c.assessment?.id, student.id)}
                          disabled={!canWrite}
                          className="w-16 rounded-lg border border-slate-300 bg-white px-1 py-2 text-center text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </Card>

      {/* Évaluations supplémentaires (deuxième contrôle, projet...) */}
      <Card title={g.extra}>
        {extras.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {extras.map((a) => (
              <li key={a.id}>
                <Link href={`/${lang}/classes/${cls.id}/notes/${a.id}`} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2.5 hover:bg-blue-50">
                  <span>
                    <span className="font-medium">{g.kinds[a.kind]}</span>
                    {a.title && <span className="ms-2 text-sm text-slate-500">{a.title}</span>}
                  </span>
                  <span className="text-sm text-slate-600">{g.enterGrades}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-blue-700">{g.addExtra}</summary>
            <ActionForm action={createAssessment.bind(null, lang, cls.id, termId)} labels={formLabels(dict, g.enterGrades)} className="mt-3 flex flex-col gap-4">
              <input type="hidden" name="subjectId" value={subject.subjectId} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={g.kind}>
                  <Select name="kind" defaultValue="CONTROL">
                    {(["ORAL", "CONTROL", "SYNTHESIS", "PRACTICAL", "OTHER"] as const).map((k) => (
                      <option key={k} value={k}>{g.kinds[k]}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={g.label} hint={dict.common.optional}>
                  <Input name="title" maxLength={80} />
                </Field>
                <Field label={g.maxScore}>
                  <Input name="maxScore" inputMode="decimal" dir="ltr" defaultValue="20" />
                </Field>
                <Field label={g.date} hint={dict.common.optional}>
                  <Input name="date" type="date" />
                </Field>
              </div>
            </ActionForm>
          </details>
        )}
      </Card>
    </>
  );
}
