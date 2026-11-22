import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { personName, pickName } from "@/i18n/localized";
import { requireContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { hasStudentAccess } from "@/lib/auth/scope";
import { db } from "@/lib/db";
import { computeClassReport, getStudentClass, getTerms, isGuardianOf, pickTerm } from "@/lib/data/grades";
import { getCurrentYear } from "@/lib/data/school";
import { Card, PageHeader } from "@/components/ui";
import { TermTabs } from "../../../classes/class-tabs";

/** Format d'une note : « 14,5 » en français, « 14.5 » en arabe. */
function num(n: number, lang: Locale) {
  const s = String(Math.round(n * 100) / 100);
  return lang === "fr" ? s.replace(".", ",") : s;
}

/**
 * Notes d'un élève au fil du trimestre (avant le bulletin). Les parents n'y
 * ont accès que si l'école l'a activé dans ses paramètres.
 */
export default async function StudentGradesPage({ params, searchParams }: PageProps<"/[lang]/eleves/[id]/notes">) {
  const { lang: rawLang, id } = await params;
  const sp = await searchParams;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requireContext(lang);
  const schoolId = ctx.school.id;
  const isStaff = can(ctx.roles, "grades.read") && (await hasStudentAccess(ctx, id));
  const isParent = !isStaff && can(ctx.roles, "children.read") && (await isGuardianOf(schoolId, ctx.user.id, id));
  if (!isStaff && !(isParent && ctx.school.showGradesToParents)) redirect(`/${lang}/acces-refuse`);

  const student = await db.student.findFirst({ where: { id, schoolId } });
  const year = await getCurrentYear(schoolId);
  const enrollment = student && year ? await getStudentClass(schoolId, id, year.id) : null;
  if (!student || !enrollment) notFound();
  const terms = await getTerms(schoolId, year!.id, enrollment.classGroup.gradeLevel.cycle);
  const term = pickTerm(terms, typeof sp.trimestre === "string" ? sp.trimestre : undefined);
  const p = dict.progress;

  const [report, assessments] = term
    ? await Promise.all([
        computeClassReport(schoolId, enrollment.classGroupId, term.id),
        db.assessment.findMany({
          where: { schoolId, classGroupId: enrollment.classGroupId, termId: term.id },
          include: { grades: { where: { studentId: id } } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        }),
      ])
    : [null, []];

  const subjects = (report?.subjects ?? [])
    .map((s) => ({
      subject: s.subject,
      coefficient: s.coefficient,
      average: s.averages.get(id) ?? null,
      items: assessments
        .filter((a) => a.subjectId === s.subject.id)
        .map((a) => ({ a, g: a.grades[0] }))
        .filter(({ g }) => g && (g.score != null || g.absent)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={p.title}
        subtitle={personName(student, lang)}
        back={isStaff ? { href: `/${lang}/eleves/${id}`, label: dict.nav.back } : { href: `/${lang}/tableau-de-bord`, label: dict.nav.dashboard }}
      />
      {term && <TermTabs terms={terms} activeId={term.id} lang={lang} hrefFor={(tid) => `/${lang}/eleves/${id}/notes?trimestre=${tid}`} />}
      <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">{p.provisional}</p>
      {subjects.length === 0 ? (
        <Card><p className="text-slate-600">{p.none}</p></Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {subjects.map((s) => (
            <li key={s.subject.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-bold">{pickName(s.subject, lang)}</h2>
                {s.average != null && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${s.average >= 10 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                    <bdi dir="ltr">{num(s.average, lang)} / 20</bdi>
                  </span>
                )}
              </div>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {s.items.map(({ a, g }) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{a.title || dict.grades.kinds[a.kind]}</span>
                      {a.date && (
                        <span className="text-xs text-slate-500">
                          {new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", timeZone: "UTC" }).format(a.date)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {g!.absent ? dict.grades.absent : <bdi dir="ltr">{num(Number(g!.score), lang)} / {num(Number(a.maxScore), lang)}</bdi>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
