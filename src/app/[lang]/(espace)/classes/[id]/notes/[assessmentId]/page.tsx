import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { personName, pickName } from "@/i18n/localized";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getAssessment } from "@/lib/data/grades";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { deleteAssessment, saveGrades } from "../../../grades-actions";

export default async function AssessmentPage({ params }: PageProps<"/[lang]/classes/[id]/notes/[assessmentId]">) {
  const { lang: rawLang, id, assessmentId } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "grades.read");
  const a = await getAssessment(ctx.school.id, assessmentId);
  if (!a || a.classGroupId !== id) notFound();
  const canWrite = can(ctx.roles, "grades.write");
  const g = dict.grades;
  const max = Number(a.maxScore);
  const grades = new Map(a.grades.map((x) => [x.studentId, x]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${g.kinds[a.kind]} · ${pickName(a.subject, lang)}`}
        subtitle={`${lang === "ar" ? a.term.nameAr : a.term.nameFr}${a.title ? ` · ${a.title}` : ""} · ${g.maxScore} ${max}`}
        back={{ href: `/${lang}/classes/${id}/notes?trimestre=${a.termId}`, label: g.title }}
      />

      <Card>
        <p className="mb-3 text-sm text-slate-600">{t(g.scoreHint, { max })}</p>
        <ActionForm action={saveGrades.bind(null, lang, a.id)} labels={formLabels(dict)}>
          <ol className="divide-y divide-slate-100">
            {a.classGroup.enrollments.map(({ student }, i) => {
              const grade = grades.get(student.id);
              return (
                <li key={student.id} className="flex items-center gap-3 py-2">
                  <span className="w-6 text-sm text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{personName(student, lang)}</span>
                  <input
                    name={`score_${student.id}`}
                    inputMode="decimal"
                    dir="ltr"
                    aria-label={`${g.score} ${personName(student, lang)}`}
                    defaultValue={grade?.score != null ? Number(grade.score) : ""}
                    disabled={!canWrite}
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" name={`absent_${student.id}`} defaultChecked={grade?.absent} disabled={!canWrite} className="size-5" />
                    {g.absent}
                  </label>
                </li>
              );
            })}
          </ol>
        </ActionForm>
      </Card>

      {canWrite && (
        <ActionForm
          action={deleteAssessment.bind(null, lang, a.id)}
          labels={formLabels(dict, g.deleteAssessment)}
          variant="danger"
          confirm={`${g.deleteAssessment} ?`}
        />
      )}
    </div>
  );
}
