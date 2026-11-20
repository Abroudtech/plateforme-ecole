import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getClass } from "@/lib/data/classes";
import { getAssessments, getClassCurriculum, getTerms, pickTerm } from "@/lib/data/grades";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { ClassTabs, TermTabs } from "../../class-tabs";
import { createAssessment } from "../../grades-actions";

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
  const [curriculum, assessments] = await Promise.all([
    getClassCurriculum(ctx.school.id, cls),
    term ? getAssessments(ctx.school.id, cls.id, term.id) : Promise.resolve([]),
  ]);
  const canWrite = can(ctx.roles, "grades.write");
  const total = cls.enrollments.length;
  const g = dict.grades;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={lang === "ar" && cls.nameAr ? cls.nameAr : cls.name} subtitle={g.title} back={{ href: `/${lang}/classes`, label: dict.classes.title }} />
      <ClassTabs lang={lang} classId={cls.id} dict={dict} active="grades" />

      {!term ? (
        <Card><p className="text-slate-600">{g.noTerms}</p></Card>
      ) : curriculum.length === 0 ? (
        <Card>
          <p className="text-slate-600">{g.noCurriculum}</p>
          <Link href={`/${lang}/classes/${cls.id}/matieres`} className="mt-2 inline-block font-medium text-blue-700 underline">{dict.curriculum.title}</Link>
        </Card>
      ) : (
        <>
          <TermTabs terms={terms} activeId={term.id} lang={lang} hrefFor={(tid) => `/${lang}/classes/${cls.id}/notes?trimestre=${tid}`} />

          {curriculum.map((c) => {
            const list = assessments.filter((a) => a.subjectId === c.subjectId);
            return (
              <Card key={c.id}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold">{pickName(c.subject, lang)}</h2>
                  <span className="text-xs text-slate-500">{dict.curriculum.coefficient} {Number(c.coefficient)}</span>
                </div>
                {list.length === 0 ? (
                  <p className="text-sm text-slate-500">{g.noAssessments}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {list.map((a) => (
                      <li key={a.id}>
                        <Link href={`/${lang}/classes/${cls.id}/notes/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 hover:bg-blue-50">
                          <span>
                            <span className="font-medium">{g.kinds[a.kind]}</span>
                            {a.title && <span className="ms-2 text-sm text-slate-500">{a.title}</span>}
                          </span>
                          <span className={`text-sm ${a._count.grades < total ? "text-amber-700" : "text-green-700"}`}>
                            {t(g.entered, { count: a._count.grades, total })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          {canWrite && (
            <Card title={g.addAssessment}>
              <ActionForm action={createAssessment.bind(null, lang, cls.id, term.id)} labels={formLabels(dict, g.enterGrades)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={g.subject}>
                    <Select name="subjectId" required defaultValue="">
                      <option value="" disabled>—</option>
                      {curriculum.map((c) => (
                        <option key={c.subjectId} value={c.subjectId}>{pickName(c.subject, lang)}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={g.kind}>
                    <Select name="kind" defaultValue="CONTROL">
                      {(["CONTROL", "SYNTHESIS", "ORAL", "PRACTICAL", "OTHER"] as const).map((k) => (
                        <option key={k} value={k}>{g.kinds[k]}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={g.label} hint={dict.common.optional}>
                    <Input name="title" maxLength={80} />
                  </Field>
                  <Field label={g.date} hint={dict.common.optional}>
                    <Input name="date" type="date" />
                  </Field>
                  <Field label={g.maxScore}>
                    <Input name="maxScore" inputMode="decimal" dir="ltr" defaultValue="20" />
                  </Field>
                  <Field label={g.weight}>
                    <Input name="weight" inputMode="decimal" dir="ltr" defaultValue="1" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
